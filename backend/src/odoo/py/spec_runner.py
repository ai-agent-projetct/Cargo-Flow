"""Runs the Python properties of the instance's JSON print specs.

Input (stdin, JSON): {"record": <snapshot>, "env": {...}, "snippets": [{"name", "code"}]}
Output (stdout, JSON): {name: value}

The snippets are the upstream product.json.specification.property
python_code bodies, unchanged. `record` is a read-only view over a JSON
snapshot of the record and its links, shaped like an Odoo recordset:
attribute access, falsy empties, .filtered(), .mapped(), iteration, ids.
"""
import datetime
import json
import sys
import time

try:
    from dateutil import relativedelta  # noqa: F401
except Exception:  # pragma: no cover - optional
    relativedelta = None


class Empty:
    """A missing record: every attribute is falsy, like an empty recordset."""
    id = False
    ids = []

    def __getattr__(self, name):
        return Empty()

    def __bool__(self):
        return False

    def __iter__(self):
        return iter([])

    def __len__(self):
        return 0

    def __eq__(self, other):
        return not other

    def __hash__(self):
        return 0

    def __call__(self, *a, **k):
        return Empty()

    def __str__(self):
        return ''

    def __add__(self, other):
        return other

    def __radd__(self, other):
        return other

    def filtered(self, fn):
        return RecSet([])

    def mapped(self, fn):
        return []

    def sorted(self, key=None, reverse=False):
        return RecSet([])


def wrap(value):
    if isinstance(value, dict) and '_model' in value:
        return Rec(value)
    if isinstance(value, list) and (not value or (isinstance(value[0], dict) and '_model' in value[0])):
        return RecSet([Rec(v) for v in value])
    if value is None:
        return False
    return value


class Rec:
    def __init__(self, data):
        self._d = data

    @property
    def id(self):
        return self._d.get('id')

    @property
    def ids(self):
        return [self._d.get('id')]

    def __getattr__(self, name):
        if name.startswith('__'):
            raise AttributeError(name)
        ftype = (self._d.get('_types') or {}).get(name)
        relational = ftype in ('many2one', 'one2many', 'many2many') or (ftype is None and (name.endswith('_id') or name.endswith('_ids')))
        if name not in self._d or self._d[name] in (None, False, ''):
            if relational:
                return Empty() if not name.endswith('_ids') and ftype != 'one2many' and ftype != 'many2many' else RecSet([])
            return False
        value = self._d[name]
        # Dates arrive as ISO strings; Odoo hands snippets date objects.
        if ftype == 'date' and isinstance(value, str):
            try:
                return datetime.date.fromisoformat(value[:10])
            except ValueError:
                return value
        if ftype == 'datetime' and isinstance(value, str):
            try:
                return datetime.datetime.strptime(value[:19], '%Y-%m-%d %H:%M:%S')
            except ValueError:
                return value
        return wrap(value)

    def __bool__(self):
        return True

    def __eq__(self, other):
        return isinstance(other, Rec) and other._d.get('_model') == self._d.get('_model') and other._d.get('id') == self._d.get('id')

    def __hash__(self):
        return hash((self._d.get('_model'), self._d.get('id')))

    def __iter__(self):
        return iter([self])

    def __len__(self):
        return 1

    def __getitem__(self, i):
        return self

    def filtered(self, fn):
        return RecSet([self]).filtered(fn)

    def mapped(self, fn):
        return RecSet([self]).mapped(fn)

    def ensure_one(self):
        return self

    def exists(self):
        return self

    def __str__(self):
        return str(self._d.get('display_name') or self._d.get('name') or '')

    def __repr__(self):
        return '%s(%s)' % (self._d.get('_model'), self._d.get('id'))


class RecSet(list):
    @property
    def ids(self):
        return [r.id for r in self]

    @property
    def id(self):
        return self[0].id if self else False

    def __getattr__(self, name):
        if not self:
            return Empty()
        if len(self) == 1:
            return getattr(self[0], name)
        vals = [getattr(r, name) for r in self]
        if vals and isinstance(vals[0], Rec):
            return RecSet(vals)
        return vals[0]

    def filtered(self, fn):
        if isinstance(fn, str):
            return RecSet([r for r in self if getattr(r, fn)])
        return RecSet([r for r in self if fn(r)])

    def mapped(self, fn):
        out = []
        for r in self:
            v = fn(r) if callable(fn) else _path(r, fn)
            out.extend(v if isinstance(v, RecSet) else [v])
        if out and all(isinstance(v, Rec) for v in out):
            return RecSet(out)
        return out

    def sorted(self, key=None, reverse=False):
        if isinstance(key, str):
            k = key
            key = lambda r: getattr(r, k) or 0  # noqa: E731
        return RecSet(sorted(self, key=key or (lambda r: r.id or 0), reverse=reverse))

    def ensure_one(self):
        return self[0] if self else Empty()

    def __add__(self, other):
        return RecSet(list(self) + list(other or []))

    def __bool__(self):
        return len(self) > 0


def _path(rec, path):
    cur = rec
    for part in path.split('.'):
        cur = getattr(cur, part)
    return cur


class Model:
    """env['model'] - search/browse over the snapshot's reference lists."""

    def __init__(self, name, refs):
        self._name = name
        self._refs = refs

    def search(self, domain=None, limit=None, order=None):
        rows = [Rec(r) for r in self._refs.get(self._name, [])]
        for leaf in domain or []:
            if isinstance(leaf, (list, tuple)) and len(leaf) == 3 and leaf[1] in ('=', '=='):
                rows = [r for r in rows if getattr(r, leaf[0]) == leaf[2] or (isinstance(getattr(r, leaf[0]), Rec) and getattr(r, leaf[0]).id == leaf[2])]
        return RecSet(rows[:limit] if limit else rows)

    def browse(self, ids):
        ids = ids if isinstance(ids, list) else [ids]
        return RecSet([Rec(r) for r in self._refs.get(self._name, []) if r.get('id') in ids])

    def search_count(self, domain=None):
        return len(self.search(domain))


class Env:
    def __init__(self, data):
        self._data = data
        self.user = Rec(data.get('user') or {'_model': 'res.users', 'id': 0, 'name': ''})
        self.company = getattr(self.user, 'company_id')
        self.context = data.get('context') or {}
        self.lang = 'en_US'

    def ref(self, xmlid, raise_if_not_found=True):
        found = (self._data.get('xmlids') or {}).get(xmlid)
        return Rec(found) if found else Empty()

    def __getitem__(self, name):
        return Model(name, self._data.get('refs') or {})


class UserError(Exception):
    pass


def float_compare(a, b, precision_digits=2, precision_rounding=None):
    a, b = round(float(a or 0), precision_digits), round(float(b or 0), precision_digits)
    return 0 if a == b else (1 if a > b else -1)


def to_json(value):
    if isinstance(value, Rec):
        return value._d
    if isinstance(value, Empty):
        return False
    if isinstance(value, RecSet):
        return [r._d for r in value]
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    if isinstance(value, dict):
        return {k: to_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [to_json(v) for v in value]
    return value


SAFE_BUILTINS = {k: __builtins__[k] if isinstance(__builtins__, dict) else getattr(__builtins__, k) for k in (
    'abs', 'all', 'any', 'bool', 'dict', 'enumerate', 'filter', 'float', 'int', 'isinstance', 'len', 'list',
    'map', 'max', 'min', 'range', 'reversed', 'round', 'set', 'sorted', 'str', 'sum', 'tuple', 'zip', 'Exception',
    'ValueError', 'KeyError', 'IndexError', 'TypeError', 'AttributeError', 'True', 'False', 'None', 'hasattr', 'getattr',
)}


ALLOWED_MODULES = {'datetime', 'time', 'math', 're', 'base64', 'json', 'pytz', 'dateutil', 'dateutil.relativedelta', 'calendar', 'decimal'}


def safe_import(name, *args, **kwargs):
    if name.split('.')[0] not in {m.split('.')[0] for m in ALLOWED_MODULES}:
        raise ImportError('import of %s is not allowed in print specs' % name)
    return __import__(name, *args, **kwargs)


SAFE_BUILTINS['__import__'] = safe_import


def main():
    payload = json.loads(sys.stdin.read() or '{}')
    record = Rec(payload.get('record') or {'_model': 'x', 'id': 0})
    env = Env(payload.get('env') or {})
    out = {}
    for s in payload.get('snippets') or []:
        scope = {
            '__builtins__': SAFE_BUILTINS, 'env': env, 'record': record, 'model': Model(record._d.get('_model'), {}),
            'time': time, 'datetime': datetime, 'dateutil': relativedelta, 'relativedelta': relativedelta,
            'timezone': None, 'float_compare': float_compare, 'log': lambda *a, **k: None, 'UserError': UserError,
            'result': False,
        }
        try:
            exec(s.get('code') or '', scope)  # noqa: S102 - upstream spec code, restricted builtins
            out[s['name']] = to_json(scope.get('result', False))
        except Exception as e:  # one bad property must not lose the document
            out[s['name']] = False
            out.setdefault('__errors__', {})[s['name']] = '%s: %s' % (type(e).__name__, e)
    sys.stdout.write(json.dumps(out, default=str))


if __name__ == '__main__':
    main()
