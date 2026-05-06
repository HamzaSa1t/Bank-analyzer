remove these text from the website (in arabic & in english):
 "الشفافية"

remove this whole box and text ( in arabic & en)
ملاحظة مهمة
الأداء القوي للنموذج لا يعني قرارات مثالية. في الواقع، تُستخدم هذه المقاييس إلى جانب التسعير والربحية وسياسات البنك لاتخاذ القرار النهائي.


remove all the "  — " from any text in the website in both languages 

2- 

these texts have a problem: "جنس المتقدم
عمر المتقدم
عمر السيارة
مدة التوظيف
تاريخ المدفوعات المتأخرة
القسط الشهري
أعلى ضغط دين على الائتمان الحالي
المبلغ الممول مقارنة بقيمة الشيء
ضغط القسط الشهري
قوة السجل الائتماني العامة"

first: in the english version they appear in arabic instead of english:
second: the bars in the chart in the arabic version covers the text

also this text: "قوة السجل الائتماني العامة
ملخص عام لقوة السجل الائتماني وسلوك السداد السابق.

ضغط القسط الشهري
القسط الشهري كنسبة من إجمالي القرض — النسب الأعلى تعني فترة سداد أقصر وعبء شهري أكبر.

المبلغ الممول مقارنة بقيمة الشيء
سعر السلعة الممولة كنسبة من مبلغ القرض — كلما اقتربت من 1 كان مساهمة المتقدّم في الدفعة الأولى أقل.

أعلى ضغط دين على الائتمان الحالي
أعلى نسبة دين مستحق إلى إجمالي القرض عبر حسابات الجهات الائتمانية — مؤشر على ضغط الديون.

القسط الشهري
القسط الشهري — الأقساط الأكبر ترفع احتمال التعثّر.

تاريخ المدفوعات المتأخرة
نسبة الأقساط السابقة المسدّدة متأخرة — أقوى مؤشر سلوكي للمخاطر.

مدة التوظيف
سنوات العمل لدى صاحب العمل الحالي — المدة الأطول ترتبط بدخل أكثر استقرارًا.

عمر السيارة
عمر السيارة المملوكة بالسنوات — يرتبط بالاستقرار وعمر الأصول.

عمر المتقدم
عمر المتقدّم — يرتبط ارتباطًا غير خطي بالاستقرار المالي.

جنس المتقدم
جنس المتقدّم (ذكر) — يستخدمه النموذج كميزة لكنه يستلزم مراجعة لاعتبارات العدالة." is not translated to english in the english version of the website

3- make this "اختر بنكًا أدناه للمتابعة." look more like a botton in both languages 


4- 3- make this "عرض تفاصيل النموذج" look more like a botton in both languages 

5- Before making any changes, create a git commit for the current state.

I want to redesign the animated background lines in the hero section.

Current issue:
The background waves look too abstract/sine-wave-like. I want them to feel more like real stock market / trading charts while still being clean and futuristic.

Requirements:
1. Replace the smooth wave animation with animated financial-chart style lines.
2. The chart lines should:
   - look like stock/market movement
   - move continuously in an infinite loop
   - stay connected endlessly across the screen
   - feel dynamic and realistic, not random waves
3. IMPORTANT:
   - Keep it minimal
   - ONLY lines
   - NO candlesticks
   - NO numbers
   - NO axis labels
   - NO prices
   - NO dots/points
   - NO tooltips
   - NO chart UI elements
4. The animation should feel:
   - premium
   - cinematic
   - fintech/AI style
   - smooth and elegant
5. Use multiple layered lines with different:
   - opacity
   - speed
   - amplitude/volatility
   to create depth.
6. Lines should occasionally:
   - trend upward/downward
   - consolidate
   - spike slightly
   similar to real stock charts.
7. Preserve the current dark futuristic theme and neon colors.
8. Animation must be GPU-friendly and smooth on mobile.
9. Do NOT break the hero layout or text positioning.
10. Make the animation responsive across desktop and mobile.

Preferred implementation:
- SVG paths or Canvas animation
- smooth interpolation between points
- seamless looping with no visible reset

Goal:
Make the background feel like an infinite live AI-powered financial market chart instead of decorative waves.

