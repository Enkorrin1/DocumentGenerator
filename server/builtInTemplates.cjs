const BUILT_IN_TEMPLATES = [
  {
    slug: 'vacation',
    file: 'vacation.docx',
    title: 'Отпуск',
    documentTitle: 'Заявление на отпуск',
    category: 'Заявления',
    description: 'Ежегодный отпуск с датами, количеством дней и приложениями.',
    badge: 'Популярное',
  },
  {
    slug: 'dismissal',
    file: 'dismissal.docx',
    title: 'Увольнение',
    documentTitle: 'Заявление на увольнение',
    category: 'Кадры',
    description: 'Заявление по собственному желанию с последним рабочим днем.',
    badge: 'Кадры',
  },
  {
    slug: 'day-off',
    file: 'day-off.docx',
    title: 'Отгул',
    documentTitle: 'Заявление на отгул',
    category: 'Заявления',
    description: 'Отгул на дату или несколько часов с указанием основания.',
    badge: 'Быстро',
  },
  {
    slug: 'business-trip',
    file: 'business-trip.docx',
    title: 'Командировка',
    documentTitle: 'Заявление на командировку',
    category: 'Заявления',
    description: 'Поездка с направлением, сроками и целью командировки.',
    badge: 'Работа',
  },
  {
    slug: 'employment-certificate',
    file: 'employment-certificate.docx',
    title: 'Справка',
    documentTitle: 'Справка с места работы',
    category: 'Справки',
    description: 'Подтверждение должности и подразделения сотрудника.',
    badge: 'Справка',
  },
];

module.exports = {
  BUILT_IN_TEMPLATES,
};
