// "Administration > Freight Masters > HAZ Sub Class" - dedicated list,
// mirroring CargoFlo ERP's "HAZ Sub Class" screen: Name / HAZ Class columns,
// Download-only toolbar (no Create), a checkbox + "Action > Export" menu, and
// an "Export Data" dialog.
export const HAZ_SUB_CLASSES = [
  { name: '4.1 Flammable solids', hazClass: 'Class 4: Flammable solids' },
  { name: '4.2 Solids liable to spontaneously combust', hazClass: 'Class 4: Flammable solids' },
  { name: '4.3 Solids that become unstable when wet', hazClass: 'Class 4: Flammable solids' },
  { name: '5.1 Oxidising agents', hazClass: 'Class 5: Oxidizing substances' },
  { name: '5.2 Organic agents or peroxides', hazClass: 'Class 5: Oxidizing substances' },
  { name: '6.1 Solid or liquid poisons', hazClass: 'Class 6: Substances toxic to people' },
  { name: '6.2 Biohazardous cargo', hazClass: 'Class 6: Substances toxic to people' },
  { name: 'Division 1.1: Substances and articles which have a mass explosion hazard', hazClass: 'Class 1: Explosives' },
  { name: 'Division 1.2: Substances and articles which have a projection hazard but not a mass explosion hazard', hazClass: 'Class 1: Explosives' },
  { name: 'Division 1.3: Substances and articles which have a fire hazard and either a minor blast hazard or a minor projection hazard or both', hazClass: 'Class 1: Explosives' },
  { name: 'Division 1.4: Substances and articles which present no significant hazard; only a small hazard in the event of ignition or initiation during transport with any effects largely confined to the package', hazClass: 'Class 1: Explosives' },
  { name: 'Division 1.5: Very insensitive substances which have a mass explosion hazard', hazClass: 'Class 1: Explosives' },
  { name: 'Division 1.6: Extremely insensitive articles which do not have a mass explosion hazard', hazClass: 'Class 1: Explosives' },
  { name: 'Division 2.1: Flammable gases', hazClass: 'Class 2: Flammable gases' },
  { name: 'Division 2.2: Non-flammable, non-toxic gases', hazClass: 'Class 2: Flammable gases' },
  { name: 'Division 2.3: Toxic gases', hazClass: 'Class 2: Flammable gases' },
];
