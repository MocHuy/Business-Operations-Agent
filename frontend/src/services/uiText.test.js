import { describe, expect, it } from 'vitest';
import { assignedNameLabel, demoTextLabel, departmentNameLabel, expenseCategoryLabel, jobTitleLabel, localizeDocumentText, localizeProductText, productNameLabel, systemNameLabel } from './uiText';

describe('Vietnamese presentation labels', () => {
  it.each([
    ['ViewPro 27 IPS Monitor', 'Màn hình ViewPro 27 IPS'],
    ['OfficeView 27 Monitor', 'Màn hình OfficeView 27'],
    ['OfficeView 24 Monitor', 'Màn hình OfficeView 24'],
    ['WorkMate 14 Laptop', 'Máy tính xách tay WorkMate 14'],
    ['WorkMate 15 Laptop', 'Máy tính xách tay WorkMate 15'],
    ['OfficeType USB Keyboard', 'Bàn phím OfficeType USB'],
    ['QuietType Wireless Keyboard', 'Bàn phím không dây QuietType'],
    ['OfficeClick USB Mouse', 'Chuột OfficeClick USB'],
    ['OfficeClick Wireless Mouse', 'Chuột không dây OfficeClick']
  ])('shows %s as %s without altering source data', (source, label) => {
    expect(productNameLabel(source)).toBe(label);
    expect(localizeProductText(`Đề xuất ${source} cho nhân viên.`)).toBe(`Đề xuất ${label} cho nhân viên.`);
  });

  it('translates a seeded job title in rendered documents', () => {
    expect(jobTitleLabel('Marketing Executive')).toBe('Chuyên viên tiếp thị');
    expect(localizeDocumentText('Chức danh: Marketing Executive')).toBe('Chức danh: Chuyên viên tiếp thị');
  });

  it('translates seeded department, system, expense and meeting presentation fields', () => {
    expect(departmentNameLabel('Software Engineering')).toBe('Phát triển phần mềm');
    expect(departmentNameLabel('Human Resources')).toBe('Nhân sự');
    expect(departmentNameLabel('Data & Analytics')).toBe('Dữ liệu và phân tích');
    expect(systemNameLabel('Sales Management System (SMS)')).toBe('Hệ thống quản lý bán hàng (SMS)');
    expect(expenseCategoryLabel('Meals')).toBe('Ăn uống');
    expect(assignedNameLabel('Unassigned')).toBe('Chưa cấp phát');
    expect(demoTextLabel('Q3 Sales Pipeline & Quoting Technical Alignment')).toBe('Họp kỹ thuật về báo giá và quy trình bán hàng quý 3');
    expect(localizeDocumentText('Phòng ban: Software Engineering')).toBe('Phòng ban: Phát triển phần mềm');
  });
});
