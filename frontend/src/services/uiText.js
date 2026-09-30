const jobTitleLabels = { 'Marketing Executive': 'Chuyên viên tiếp thị' };

export const jobTitleLabel = title => jobTitleLabels[title] || title;

const departments = {
  'Software Engineering': 'Phát triển phần mềm',
  'Data & Analytics': 'Dữ liệu và phân tích',
  'Human Resources': 'Nhân sự',
  'Operations Administration': 'Quản trị vận hành'
};
export const departmentNameLabel = name => departments[name] || name;

const systems = {
  'Sales Management System (SMS)': 'Hệ thống quản lý bán hàng (SMS)',
  'Marketing Analytics Platform (MAP)': 'Nền tảng phân tích tiếp thị (MAP)',
  'Enterprise Customer Relationship Management (CRM)': 'Hệ thống quản lý quan hệ khách hàng (CRM)'
};
export const systemNameLabel = name => systems[name] || name;

const demoText = {
  'Q3 Sales Pipeline & Quoting Technical Alignment': 'Họp kỹ thuật về báo giá và quy trình bán hàng quý 3',
  'Working lunch with external security audit consultant': 'Ăn trưa làm việc với chuyên gia đánh giá bảo mật bên ngoài',
  'Taxi travel to commercial printing supplier office for marketing materials': 'Đi taxi đến nhà cung cấp in ấn tài liệu tiếp thị',
  'Equip newly onboarded backend engineering squad with dual monitors.': 'Trang bị hai màn hình cho nhóm kỹ sư phần mềm mới.',
  'Replace damaged keyboards for test lab workstations.': 'Thay bàn phím hỏng tại phòng kiểm thử.'
};
export function demoTextLabel(value) {
  let result = localizeProductText(value);
  for (const [source, label] of Object.entries(demoText)) result = result.replaceAll(source, label);
  return result.replace(/^Meals(?=\s|$)/, 'Ăn uống').replace(/^Travel(?=\s|$)/, 'Đi lại').replace(/^Taxi(?=\s|$)/, 'Đi taxi');
}
export const expenseCategoryLabel = category => ({ Meals: 'Ăn uống', Travel: 'Đi lại', Taxi: 'Đi taxi' })[category] || category;
export const assignedNameLabel = name => name === 'Unassigned' ? 'Chưa cấp phát' : name;

const productTypes = { monitor: 'Màn hình', laptop: 'Máy tính xách tay', keyboard: 'Bàn phím', mouse: 'Chuột' };

export function productNameLabel(name) {
  const match = String(name || '').match(/^(.+?)\s+(Monitor|Laptop|Keyboard|Mouse)$/i);
  if (!match) return name;
  const wireless = /\s+Wireless$/i.test(match[1]);
  const model = match[1].replace(/\s+Wireless$/i, '');
  return `${productTypes[match[2].toLowerCase()]} ${wireless ? 'không dây ' : ''}${model}`;
}

export function localizeProductText(text) {
  return String(text || '').replace(/\b([A-Z][A-Za-z0-9]*(?:\s+(?:\d+(?:\.\d+)?|IPS|USB|Wireless))*)\s+(Monitor|Laptop|Keyboard|Mouse)\b/g,
    raw => productNameLabel(raw));
}

export function localizeDocumentText(text) {
  let value = localizeProductText(String(text || '').replaceAll('Marketing Executive', jobTitleLabel('Marketing Executive')));
  for (const [source, label] of Object.entries({ ...departments, ...systems, ...demoText })) value = value.replaceAll(source, label);
  return value.replaceAll('Khoản mục chi: Meals', 'Khoản mục chi: Ăn uống').replaceAll('Khoản mục chi: Travel', 'Khoản mục chi: Đi lại');
}
