export interface PlanPreset {
  id: string;
  textEN: string;
  textHE: string;
}

export const PLAN_PRESETS: PlanPreset[] = [
  {
    id: "pp-01",
    textEN: "Good daily water intake. Urine should be clear and you should not be thirsty.",
    textHE: 'שתייה יומית טובה. השתן צריך להיות צלול ואין להרגיש צמא.',
  },
  {
    id: "pp-02",
    textEN: "Avoid food and drink for 3 hours before going to bed. Evening meal should be small and low-fat. Sleep sitting up slightly.",
    textHE: 'להימנע מאוכל ושתייה 3 שעות לפני השינה. ארוחת הערב צריכה להיות קטנה ודלת שומן. לישון עם הגב מוגבה מעט.',
  },
  {
    id: "pp-03",
    textEN: "Gaviscon liquid 20cc after meals and before bed. Avoid eating and drinking for 1 hour after taking this.",
    textHE: 'גביסקון נוזלי 20 מ"ל אחרי ארוחות ולפני השינה. להימנע מאכילה ושתייה שעה אחת לאחר הנטילה.',
  },
  {
    id: "pp-04",
    textEN: "Tussophedrine cough syrup (or equivalent: must contain dextromethorphan) 10cc for cough.",
    textHE: 'סירופ לשיעול טוסופדרין (או שווה ערך: חייב להכיל דקסטרומתורפן) 10 מ"ל לשיעול.',
  },
  {
    id: "pp-05",
    textEN: "Inhalations of Aerovent 1cc + Saline 0.9% 5cc three times daily.",
    textHE: 'אינהלציות של אירוונט 1 מ"ל + מי מלח 0.9% 5 מ"ל שלוש פעמים ביום.',
  },
  {
    id: "pp-06",
    textEN: "Inhalations of Aerovent 1cc + Saline 3% 4cc twice daily. Follow this with chest physiotherapy to try and clear sputum from the lungs.",
    textHE: 'אינהלציות של אירוונט 1 מ"ל + מי מלח 3% 4 מ"ל פעמיים ביום. לאחר מכן פיזיותרפיה של בית החזה כדי לפנות כיח מהריאות.',
  },
  {
    id: "pp-07",
    textEN: "Inhalations of Aerovent 1cc + Ventolin 0.5cc + Saline 0.9% 2cc three times daily.",
    textHE: 'אינהלציות של אירוונט 1 מ"ל + ונטולין 0.5 מ"ל + מי מלח 0.9% 2 מ"ל שלוש פעמים ביום.',
  },
  {
    id: "pp-08",
    textEN: "Inhalations of Budicort (1mg/2cc respules) 2cc twice daily.",
    textHE: 'אינהלציות של בודיקורט (1 מ"ג/2 מ"ל רספולות) 2 מ"ל פעמיים ביום.',
  },
  {
    id: "pp-09",
    textEN: "Siran 200mg three times daily. Dissolve it in a small cup of water.",
    textHE: 'סירן 200 מ"ג שלוש פעמים ביום. להמיס בכוס מים קטנה.',
  },
  {
    id: "pp-10",
    textEN: "Aerobika chest physiotherapy device.",
    textHE: "מכשיר פיזיותרפיה לבית החזה אירוביקה.",
  },
  {
    id: "pp-11",
    textEN: "Avamys nasal spray 2 in each nostril once daily. Reduce this to 1 in each nostril when the symptoms are controlled. Saline nasal washes can also be used 10 minutes before using this spray.",
    textHE: "ספריי אף אוואמיס 2 בכל נחיר פעם ביום. לצמצם ל-1 בכל נחיר כאשר הסימפטומים נשלטים. ניתן גם להשתמש בשטיפות אף במי מלח 10 דקות לפני השימוש בספריי.",
  },
  {
    id: "pp-12",
    textEN: "Foster (100/6) 2 puffs twice daily. Rinse your mouth with water after use.",
    textHE: "פוסטר (100/6) 2 שאיפות פעמיים ביום. לשטוף את הפה במים לאחר השימוש.",
  },
  {
    id: "pp-13",
    textEN: "Routine blood tests: CBC, urea, creatinine, electrolytes, liver, glucose, CRP, calcium, Immunoglobulins, Total IgE.",
    textHE: "בדיקות דם שגרתיות: ספירת דם, אוריאה, קריאטינין, אלקטרוליטים, תפקודי כבד, גלוקוז, CRP, סידן, אימונוגלובולינים, IgE כולל.",
  },
  {
    id: "pp-14",
    textEN: "Bronchiectasis blood tests: CBC, urea, creatinine, electrolytes, liver, glucose, CRP, calcium, Immunoglobulins, Total IgE, ANA, ANCA (MPO/PR3), Rheumatoid factor, Anti SSA/SSB, Anti dsDNA, Anti RNP, Anti centromere, C3&C4 level, Alfa1antitrypsin protein level.",
    textHE: "בדיקות דם לברונכיאקטזיה: ספירת דם, אוריאה, קריאטינין, אלקטרוליטים, תפקודי כבד, גלוקוז, CRP, סידן, אימונוגלובולינים, IgE כולל, ANA, ANCA (MPO/PR3), גורם ראומטואיד, Anti SSA/SSB, Anti dsDNA, Anti RNP, Anti centromere, רמות C3 ו-C4, רמת חלבון אלפא-1 אנטיטריפסין.",
  },
  {
    id: "pp-15",
    textEN: "Lung fibrosis blood tests: CBC, urea, creatinine, electrolytes, liver, glucose, CRP, calcium, Immunoglobulins, IgG subtypes, ANA, ANCA (MPO/PR3), Rheumatoid factor, Anti SSA/SSB, Anti dsDNA, Anti RNP, Anti centromere, Anti Scl70, Anti Jo1, C3&C4 level.",
    textHE: "בדיקות דם לפיברוזיס ריאתי: ספירת דם, אוריאה, קריאטינין, אלקטרוליטים, תפקודי כבד, גלוקוז, CRP, סידן, אימונוגלובולינים, תת-סוגי IgG, ANA, ANCA (MPO/PR3), גורם ראומטואיד, Anti SSA/SSB, Anti dsDNA, Anti RNP, Anti centromere, Anti Scl70, Anti Jo1, רמות C3 ו-C4.",
  },
  {
    id: "pp-16",
    textEN: "Sarcoid blood tests: CBC, urea, creatinine, electrolytes, liver, glucose, CRP, calcium, Immunoglobulins.",
    textHE: "בדיקות דם לסרקואידוזיס: ספירת דם, אוריאה, קריאטינין, אלקטרוליטים, תפקודי כבד, גלוקוז, CRP, סידן, אימונוגלובולינים.",
  },
  {
    id: "pp-17",
    textEN: "Asthma blood tests: CBC, Total IgE, CRP, urea, creatinine, electrolytes, glucose, ANCA (MPO/PR3).",
    textHE: "בדיקות דם לאסתמה: ספירת דם, IgE כולל, CRP, אוריאה, קריאטינין, אלקטרוליטים, גלוקוז, ANCA (MPO/PR3).",
  },
  {
    id: "pp-18",
    textEN: "Infection blood tests: CBC, urea, creatinine, electrolytes, liver, glucose, HbA1c%, CRP, Immunoglobulins, HIV test.",
    textHE: "בדיקות דם לזיהום: ספירת דם, אוריאה, קריאטינין, אלקטרוליטים, תפקודי כבד, גלוקוז, המוגלובין מסוכרר (HbA1c%), CRP, אימונוגלובולינים, בדיקת HIV.",
  },
  {
    id: "pp-19",
    textEN: "24 hour urine calcium level.",
    textHE: "רמת סידן בשתן של 24 שעות.",
  },
  {
    id: "pp-20",
    textEN: "Sclero poly synthetase full antibody panel. Code 2x86406. Can be done in the Autoimmune Center, Sheba Hospital (contact them directly if needed).",
    textHE: "פאנל נוגדנים מלא לסקלרו פולי סינתטאז. קוד 2x86406. ניתן לבצע במרכז האוטואימוני, בית חולים שיבא (ניתן ליצור איתם קשר ישיר במידת הצורך).",
  },
  {
    id: "pp-21",
    textEN: "Full lung function tests with bronchodilator.",
    textHE: "בדיקות תפקודי ריאה מלאות עם מרחיב סימפונות.",
  },
  {
    id: "pp-22",
    textEN: "FeNO (fractional exhaled nitric oxide) test.",
    textHE: "בדיקת FeNO (תחמוצת חנקן נשיפתית).",
  },
  {
    id: "pp-23",
    textEN: "Spirometry + bronchodilator test.",
    textHE: "ספירומטריה + בדיקת מרחיב סימפונות.",
  },
  {
    id: "pp-24",
    textEN: "Cardiopulmonary exercise test (CPET).",
    textHE: "מבחן מאמץ לבבי-ריאתי (CPET).",
  },
  {
    id: "pp-25",
    textEN: "Metacholine challenge test.",
    textHE: "מבחן מתכולין.",
  },
  {
    id: "pp-26",
    textEN: "CT pulmonary angiogram.",
    textHE: "CT אנגיוגרפיה ריאתית.",
  },
  {
    id: "pp-27",
    textEN: "High resolution CT chest (no contrast needed).",
    textHE: "CT חזה ברזולוציה גבוהה (ללא צורך בחומר ניגוד).",
  },
  {
    id: "pp-28",
    textEN: "Low dose CT chest (no contrast needed).",
    textHE: "CT חזה במינון נמוך (ללא צורך בחומר ניגוד).",
  },
  {
    id: "pp-29",
    textEN: "Skin prick allergy tests for common aeroallergens including Aspergillus, Alternaria and Cladosporum.",
    textHE: "בדיקות עור לאלרגיה לאלרגנים נשאפים נפוצים כולל אספרגילוס, אלטרנריה וקלדוספוריום.",
  },
  {
    id: "pp-30",
    textEN: "Bronchoscopy + washings.",
    textHE: "ברונכוסקופיה + שטיפות.",
  },
  {
    id: "pp-31",
    textEN: "Bronchoscopy + washings + endobronchial biopsies.",
    textHE: "ברונכוסקופיה + שטיפות + ביופסיות אנדוברונכיאליות.",
  },
  {
    id: "pp-32",
    textEN: "Bronchoscopy + EBUS FNA of lymph nodes.",
    textHE: "ברונכוסקופיה + EBUS - ניקור מחט עדינה של בלוטות לימפה.",
  },
  {
    id: "pp-33",
    textEN: "Thoracentesis with samples for routine tests (biochemistry/microbiology/cytology).",
    textHE: "ניקור פלאורלי עם דגימות לבדיקות שגרתיות (ביוכימיה/מיקרוביולוגיה/ציטולוגיה).",
  },
  {
    id: "pp-34",
    textEN: "Sputum samples (at least one, ideally in the morning) to microbiology for general, mycobacterial and fungal cultures. Try to avoid contaminating the sample with saliva.",
    textHE: "דגימות כיח (לפחות אחת, רצוי בבוקר) למיקרוביולוגיה לתרביות כלליות, מיקובקטריאליות ופטרייתיות. יש לנסות להימנע מזיהום הדגימה ברוק.",
  },
];
