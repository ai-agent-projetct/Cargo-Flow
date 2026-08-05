import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User, Users, FileCheck, Truck, List, FileText, CreditCard,
  Receipt, FileMinus, Building2, FolderPlus, ClipboardCheck, ChevronRight,
} from 'lucide-react';

// The document-flow ribbon across the top of an Organization: the current step
// is highlighted amber and inert, the rest link to their related-record list.
// Hovering a step shows "Label (n) : rec1, rec2, …" exactly like the demo.
const ICONS = {
  user: User,
  users: Users,
  'file-check': FileCheck,
  truck: Truck,
  list: List,
  'file-text': FileText,
  'credit-card': CreditCard,
  'file-dollar': Receipt,
  'file-minus': FileMinus,
  building: Building2,
  'folder-plus': FolderPlus,
  'clipboard-check': ClipboardCheck,
};

const WorkflowRibbon = ({ steps, organizationId, currentStep = 'customer' }) => {
  const navigate = useNavigate();
  if (!steps?.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 overflow-x-auto">
      <div className="flex items-center gap-1 min-w-max">
        {steps.map((step, i) => {
          const Icon = ICONS[step.icon] || FileText;
          const isCurrent = step.key === currentStep;
          const tooltip = `${step.label} (${step.count})${step.names?.length ? ` : ${step.names.join(',\n')}` : ''}`;

          return (
            <React.Fragment key={step.key}>
              <button
                type="button"
                title={tooltip}
                disabled={isCurrent}
                onClick={() => navigate(`/admin/organizations/${organizationId}/${step.key}`)}
                className={`relative flex items-center justify-center w-12 h-12 rounded transition-colors ${
                  isCurrent
                    ? 'bg-amber-400 text-white cursor-default'
                    : step.count > 0
                      ? 'text-gray-600 hover:bg-blue-50 hover:text-blue-700 border border-transparent hover:border-blue-300'
                      : 'text-gray-300 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-6 h-6" />
                {step.count > 0 && !isCurrent && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-blue-700 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {step.count}
                  </span>
                )}
              </button>
              {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowRibbon;
