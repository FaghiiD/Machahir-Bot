require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const stringSimilarity = require('string-similarity');
const axios = require('axios'); // Add this to your dependencies

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const PREFIX = '+';

const aliasesMap = {
  // Football Players
  'leo messi': ['leo messi', 'messi', 'ميسي', 'ليونيل ميسي', 'ليونيل', 'ميسي', 'lionel messi'],
  'cristiano ronaldo': ['cristiano ronaldo', 'ronaldo', 'كريستيانو رونالدو', 'رونالدو', 'كريستيانو', 'cr7'],
  'neymar': ['neymar', 'نيمار', 'نيمار جونيور', 'neymar jr'],
  'kylian mbappé': ['kylian mbappé', 'mbappé', 'mbappe', 'كيليان مبابي', 'مبابي', 'كيليان'],
  'mohamed salah': ['mohamed salah', 'mohammad salah', 'muhamed salah', 'mohammed salah', 'محمد صلاح', 'صلاح', 'محمد', 'salah'],
  'zinedine zidane': ['zinedine zidane', 'zidane', 'زين الدين زيدان', 'زيدان', 'زين الدين'],
  'karim benzema': ['karim benzema', 'benzema', 'كريم بنزيمة', 'بنزيمة', 'كريم'],
  'erling haaland': ['erling haaland', 'haaland', 'إرلينغ هالاند', 'هالاند'],
  'kevin de bruyne': ['kevin de bruyne', 'de bruyne', 'كيفن دي بروين', 'دي بروين'],
  'virgil van dijk': ['virgil van dijk', 'van dijk', 'فيرجيل فان دايك', 'فان دايك'],
  
  // Moroccan Celebrities
  'saad lamjarred': ['saad lamjarred', 'saad lamjared', 'lamjarred', 'lamjared', 'سعد لمجرد', 'سعد', 'لمجرد'],
  'said mouskir': ['said mouskir', 'said mosker', 'mosker', 'سعيد مسكر', 'سعيد موسكير', 'سعيد', 'مسكر'],
  'nancy ajram': ['nancy ajram', 'nancy', 'ajram', 'نانسي عجرم', 'عجرم', 'نانسي'],
  'amr diab': ['amr diab', 'amr', 'diab', 'عمرو دياب', 'عمرو', 'دياب'],
  'fairuz': ['fairuz', 'فيروز', 'فيروز', 'فيروز'],
  'umm kulthum': ['umm kulthum', 'um kulthum', 'أم كلثوم', 'أم كلثوم', 'كلثوم'],
  'cheb khaled': ['cheb khaled', 'khaled', 'شاب خالد', 'خالد'],
  'cheb mami': ['cheb mami', 'mami', 'شاب مامي', 'مامي'],
  'don bigg': ['don bigg', 'bigg', 'دون بيغ', 'بيغ'],
  'elgrandetoto': ['elgrandetoto', 'el grande toto', 'toto', 'إلغراند توتو', 'توتو'],
  'elie saab': ['elie saab', 'saab', 'إيلي صعب', 'صعب'],
  'hassan fathy': ['hassan fathy', 'fathy', 'حسن فتحي', 'فتحي'],
  'hicham el guerrouj': ['hicham el guerrouj', 'guerrouj', 'هشام الكروج', 'الكروج'],
  'hussain al jassmi': ['hussain al jassmi', 'al jassmi', 'حسين الجسمي', 'الجسمي'],
  'ibn battuta': ['ibn battuta', 'battuta', 'ابن بطوطة', 'بطوطة'],
  'ibn khaldun': ['ibn khaldun', 'khaldun', 'ابن خلدون', 'خلدون'],
  'ibtissam tiskat': ['ibtissam tiskat', 'tiskat', 'ابتسام تسكت', 'تسكت'],
  'khadija el bidaouia': ['khadija el bidaouia', 'el bidaouia', 'خديجة البيداوية', 'البيداوية'],
  'laila lalami': ['laila lalami', 'lalami', 'ليلى العلمي', 'العلمي'],
  'mahmoud el khatib': ['mahmoud el khatib', 'el khatib', 'محمود الخطيب', 'الخطيب'],
  'majida el roumi': ['majida el roumi', 'el roumi', 'ماجدة الرومي', 'الرومي'],
  'mouna fettou': ['mouna fettou', 'fettou', 'منى فتاح', 'فتاح'],
  'naguib mahfouz': ['naguib mahfouz', 'mahfouz', 'نجيب محفوظ', 'محفوظ'],
  'nawal el saadawi': ['nawal el saadawi', 'el saadawi', 'نوال السعداوي', 'السعداوي'],
  'samira said': ['samira said', 'said', 'سميرة سعيد', 'سعيد'],
  'souad massi': ['souad massi', 'massi', 'سعاد ماسي', 'ماسي'],
  'tahar ben jelloun': ['tahar ben jelloun', 'ben jelloun', 'طاهر بن جلون', 'بن جلون'],
  'tamer hosny': ['tamer hosny', 'hosny', 'تامر حسني', 'حسني'],
  'wahbi khazri': ['wahbi khazri', 'khazri', 'وهبي خزري', 'خزري'],
  'yassine bounou': ['yassine bounou', 'bounou', 'ياسين بونو', 'بونو'],
  'younes el aynaoui': ['younes el aynaoui', 'el aynaoui', 'يونس العيناوي', 'العيناوي'],
  'youssef en nesyri': ['youssef en nesyri', 'en nesyri', 'يوسف النصيري', 'النصيري'],
  
  // Additional Moroccan Celebrities
  'fatima zahra': ['fatima zahra', 'fatima', 'zahra', 'فاطمة الزهراء', 'فاطمة', 'الزهراء'],
  'latifa raafat': ['latifa raafat', 'latifa', 'raafat', 'لطيفة رافع', 'لطيفة', 'رافع'],
  'hassan hakmoun': ['hassan hakmoun', 'hakmoun', 'حسن حكمون', 'حكمون'],
  'mohammed ben attab': ['mohammed ben attab', 'ben attab', 'محمد بن عتاب', 'بن عتاب'],
  'abdelkrim khattabi': ['abdelkrim khattabi', 'khattabi', 'عبد الكريم الخطابي', 'الخطابي'],
  'mohammed v': ['mohammed v', 'محمد الخامس', 'محمد الخامس'],
  'hassan ii': ['hassan ii', 'الحسن الثاني', 'الحسن الثاني'],
  'mohammed vi': ['mohammed vi', 'محمد السادس', 'محمد السادس'],
  
  // Additional Egyptian Celebrities
  'abdel halim hafez': ['abdel halim hafez', 'halim hafez', 'عبد الحليم حافظ', 'حافظ'],
  'warda al jazairia': ['warda al jazairia', 'warda', 'وردة الجزائرية', 'وردة'],
  'kadim al sahir': ['kadim al sahir', 'kadim', 'كاظم الساهر', 'كاظم'],
  'ragheb alama': ['ragheb alama', 'ragheb', 'راغب علامة', 'راغب'],
  'elissa': ['elissa', 'إليسا', 'إليسا'],
  'haifa wehbe': ['haifa wehbe', 'haifa', 'هيفاء وهبي', 'هيفاء'],
  'sherine': ['sherine', 'شيرين', 'شيرين'],
  'umar khayyam': ['umar khayyam', 'khayyam', 'عمر الخيام', 'الخيام'],
  'ahmed shawki': ['ahmed shawki', 'shawki', 'أحمد شوقي', 'شوقي'],
  'taha hussein': ['taha hussein', 'taha', 'طه حسين', 'طه'],
  'youssef wahbi': ['youssef wahbi', 'wahbi', 'يوسف وهبي', 'وهبي'],
  'adel imam': ['adel imam', 'adel', 'عادل إمام', 'عادل'],
  'ahmed helmy': ['ahmed helmy', 'helmy', 'أحمد حلمي', 'حلمي'],
  'mohamed henida': ['mohamed henida', 'henida', 'محمد هنيدي', 'هنيدي'],
  'yousra': ['yousra', 'يسرا', 'يسرا'],
  'faten hamama': ['faten hamama', 'faten', 'فاتن حمامة', 'فاتن'],
  'souad hosni': ['souad hosni', 'souad', 'سعاد حسني', 'سعاد'],
  
  // Additional Tunisian Celebrities
  'lotfi bouchnak': ['lotfi bouchnak', 'lotfi', 'لطفي بوشناق', 'لطفي'],
  'sabri mosbah': ['sabri mosbah', 'sabri', 'صبري مصباح', 'صبري'],
  'emel mathlouthi': ['emel mathlouthi', 'emel', 'إيمل المثلوثي', 'إيمل'],
  'dhafer youssef': ['dhafer youssef', 'dhafer', 'ظافر يوسف', 'ظافر'],
  'anis gharbi': ['anis gharbi', 'anis', 'أنيس غربي', 'أنيس'],
  'sami fekri': ['sami fekri', 'sami', 'سامي فكري', 'سامي'],
  'sabah': ['sabah', 'صباح', 'صباح'],
  'hassen doss': ['hassen doss', 'hassen', 'حسن دوس', 'حسن'],
  
  // Additional Algerian Celebrities
  'cheb hasni': ['cheb hasni', 'hasni', 'شاب حسني', 'حسني'],
  'rachid taha': ['rachid taha', 'rachid', 'رشيد طه', 'رشيد'],
  'khaled': ['khaled', 'خالد', 'خالد'],
  'rachid ghezzal': ['rachid ghezzal', 'ghezzal', 'رشيد غزال', 'رشيد'],
  'yacine brahimi': ['yacine brahimi', 'brahimi', 'ياسين براهيمي', 'ياسين'],
  'sofiane feghouli': ['sofiane feghouli', 'feghouli', 'سفيان فيغولي', 'سفيان'],
  'ryad mahrez': ['ryad mahrez', 'mahrez', 'رياض محرز', 'رياض'],
  'islam slimani': ['islam slimani', 'slimani', 'إسلام سليماني', 'إسلام'],
  'abdelkader bentoumi': ['abdelkader bentoumi', 'bentoumi', 'عبد القادر بن تومي', 'بن تومي'],
  'hassiba boulmerka': ['hassiba boulmerka', 'boulmerka', 'حسيبة بولمرقة', 'حسيبة'],
  'nouria benida merrah': ['nouria benida merrah', 'nouria', 'نورية بنيدة مراح', 'نورية'],
  
  // Additional Arab Celebrities from Other Countries
  'fayrouz': ['fayrouz', 'فيروز', 'فيروز'],
  'marcel khalife': ['marcel khalife', 'marcel', 'مارسيل خليفة', 'مارسيل'],
  'julia boutros': ['julia boutros', 'julia', 'جوليا بطرس', 'جوليا'],
  'georges wassouf': ['georges wassouf', 'georges', 'جورج وسوف', 'جورج'],
  'fadl shaker': ['fadl shaker', 'fadl', 'فضل شاكر', 'فضل'],
  'diana haddad': ['diana haddad', 'diana', 'ديانا حداد', 'ديانا'],
  'ahlam': ['ahlam', 'أحلام', 'أحلام'],
  'balqees': ['balqees', 'بلقيس', 'بلقيس'],
  'arwa': ['arwa', 'أروى', 'أروى'],
  'abdel rahman al rahbi': ['abdel rahman al rahbi', 'al rahbi', 'عبد الرحمن الرحبي', 'الرحبي'],
  'abou bakr salim': ['abou bakr salim', 'abou bakr', 'أبو بكر سالم', 'أبو بكر'],
  'ahmed fathallah': ['ahmed fathallah', 'fathallah', 'أحمد فتح الله', 'فتح الله'],
  'mohammed abdu': ['mohammed abdu', 'abdu', 'محمد عبده', 'عبده'],
  'talal maddah': ['talal maddah', 'talal', 'طلال مداح', 'طلال'],
  'abdel majeed abdullah': ['abdel majeed abdullah', 'abdullah', 'عبد المجيد عبد الله', 'عبد الله'],
  'mohammed rashid': ['mohammed rashid', 'rashid', 'محمد رشيد', 'رشيد'],
  'najah salam': ['najah salam', 'najah', 'نجاح سلام', 'نجاح']
};

// Add Arabic names mapping
const arabicNames = {
  // Football Players
  'leo messi': 'ليونيل ميسي',
  'cristiano ronaldo': 'كريستيانو رونالدو',
  'neymar': 'نيمار جونيور',
  'kylian mbappé': 'كيليان مبابي',
  'mohamed salah': 'محمد صلاح',
  'zinedine zidane': 'زين الدين زيدان',
  'karim benzema': 'كريم بنزيمة',
  'erling haaland': 'إرلينغ هالاند',
  'kevin de bruyne': 'كيفن دي بروين',
  'virgil van dijk': 'فيرجيل فان دايك',
  
  // Moroccan Celebrities
  'saad lamjarred': 'سعد لمجرد',
  'said mouskir': 'سعيد مسكر',
  'nancy ajram': 'نانسي عجرم',
  'amr diab': 'عمرو دياب',
  'fairuz': 'فيروز',
  'umm kulthum': 'أم كلثوم',
  'cheb khaled': 'شاب خالد',
  'cheb mami': 'شاب مامي',
  'don bigg': 'دون بيغ',
  'elgrandetoto': 'إلغراند توتو',
  'elie saab': 'إيلي صعب',
  'hassan fathy': 'حسن فتحي',
  'hicham el guerrouj': 'هشام الكروج',
  'hussain al jassmi': 'حسين الجسمي',
  'ibn battuta': 'ابن بطوطة',
  'ibn khaldun': 'ابن خلدون',
  'ibtissam tiskat': 'ابتسام تسكت',
  'khadija el bidaouia': 'خديجة البيداوية',
  'laila lalami': 'ليلى العلمي',
  'mahmoud el khatib': 'محمود الخطيب',
  'majida el roumi': 'ماجدة الرومي',
  'mouna fettou': 'منى فتاح',
  'naguib mahfouz': 'نجيب محفوظ',
  'nawal el saadawi': 'نوال السعداوي',
  'samira said': 'سميرة سعيد',
  'souad massi': 'سعاد ماسي',
  'tahar ben jelloun': 'طاهر بن جلون',
  'tamer hosny': 'تامر حسني',
  'wahbi khazri': 'وهبي خزري',
  'yassine bounou': 'ياسين بونو',
  'younes el aynaoui': 'يونس العيناوي',
  'youssef en nesyri': 'يوسف النصيري',
  
  // Additional Moroccan Celebrities
  'fatima zahra': 'فاطمة الزهراء',
  'latifa raafat': 'لطيفة رافع',
  'hassan hakmoun': 'حسن حكمون',
  'mohammed ben attab': 'محمد بن عتاب',
  'abdelkrim khattabi': 'عبد الكريم الخطابي',
  'mohammed v': 'محمد الخامس',
  'hassan ii': 'الحسن الثاني',
  'mohammed vi': 'محمد السادس',
  
  // Additional Egyptian Celebrities
  'abdel halim hafez': 'عبد الحليم حافظ',
  'warda al jazairia': 'وردة الجزائرية',
  'kadim al sahir': 'كاظم الساهر',
  'ragheb alama': 'راغب علامة',
  'elissa': 'إليسا',
  'haifa wehbe': 'هيفاء وهبي',
  'sherine': 'شيرين',
  'umar khayyam': 'عمر الخيام',
  'ahmed shawki': 'أحمد شوقي',
  'taha hussein': 'طه حسين',
  'youssef wahbi': 'يوسف وهبي',
  'adel imam': 'عادل إمام',
  'ahmed helmy': 'أحمد حلمي',
  'mohamed henida': 'محمد هنيدي',
  'yousra': 'يسرا',
  'faten hamama': 'فاتن حمامة',
  'souad hosni': 'سعاد حسني',
  
  // Additional Tunisian Celebrities
  'lotfi bouchnak': 'لطفي بوشناق',
  'sabri mosbah': 'صبري مصباح',
  'emel mathlouthi': 'إيمل المثلوثي',
  'dhafer youssef': 'ظافر يوسف',
  'anis gharbi': 'أنيس غربي',
  'sami fekri': 'سامي فكري',
  'sabah': 'صباح',
  'hassen doss': 'حسن دوس',
  
  // Additional Algerian Celebrities
  'cheb hasni': 'شاب حسني',
  'rachid taha': 'رشيد طه',
  'khaled': 'خالد',
  'rachid ghezzal': 'رشيد غزال',
  'yacine brahimi': 'ياسين براهيمي',
  'sofiane feghouli': 'سفيان فيغولي',
  'ryad mahrez': 'رياض محرز',
  'islam slimani': 'إسلام سليماني',
  'abdelkader bentoumi': 'عبد القادر بن تومي',
  'hassiba boulmerka': 'حسيبة بولمرقة',
  'nouria benida merrah': 'نورية بنيدة مراح',
  
  // Additional Arab Celebrities from Other Countries
  'fayrouz': 'فيروز',
  'marcel khalife': 'مارسيل خليفة',
  'julia boutros': 'جوليا بطرس',
  'georges wassouf': 'جورج وسوف',
  'fadl shaker': 'فضل شاكر',
  'diana haddad': 'ديانا حداد',
  'ahlam': 'أحلام',
  'balqees': 'بلقيس',
  'arwa': 'أروى',
  'abdel rahman al rahbi': 'عبد الرحمن الرحبي',
  'abou bakr salim': 'أبو بكر سالم',
  'ahmed fathallah': 'أحمد فتح الله',
  'mohammed abdu': 'محمد عبده',
  'talal maddah': 'طلال مداح',
  'abdel majeed abdullah': 'عبد المجيد عبد الله',
  'mohammed rashid': 'محمد رشيد',
  'najah salam': 'نجاح سلام'
};

// Add celebrity descriptions in Arabic
const celebrityDescriptions = {
  // Football Players
  'leo messi': 'لاعب كرة قدم أرجنتيني محترف، يعتبر من أعظم اللاعبين في التاريخ',
  'cristiano ronaldo': 'لاعب كرة قدم برتغالي محترف، أحد أفضل اللاعبين في العالم',
  'neymar': 'لاعب كرة قدم برازيلي محترف، معروف بمهاراته الفنية العالية',
  'kylian mbappé': 'لاعب كرة قدم فرنسي محترف، أحد أسرع اللاعبين في العالم',
  'mohamed salah': 'لاعب كرة قدم مصري محترف، يلعب في الدوري الإنجليزي',
  'zinedine zidane': 'مدرب كرة قدم فرنسي سابق، كان لاعباً مميزاً في خط الوسط',
  'karim benzema': 'لاعب كرة قدم فرنسي محترف، مهاجم مميز في ريال مدريد',
  'erling haaland': 'لاعب كرة قدم نرويجي محترف، مهاجم قوي في مانشستر سيتي',
  'kevin de bruyne': 'لاعب كرة قدم بلجيكي محترف، وسط هجومي مميز',
  'virgil van dijk': 'لاعب كرة قدم هولندي محترف، مدافع قوي في ليفربول',
  
  // Moroccan Celebrities
  'saad lamjarred': 'مغني مغربي مشهور، من أشهر المطربين في العالم العربي',
  'said mouskir': 'مغني مغربي، من رواد الأغنية المغربية الحديثة',
  'nancy ajram': 'مغنية لبنانية مشهورة، تعرف بملكة جمال العرب',
  'amr diab': 'مغني مصري مشهور، يعرف بفنان العرب',
  'fairuz': 'مغنية لبنانية أسطورية، من أشهر المطربين العرب',
  'umm kulthum': 'مغنية مصرية أسطورية، تعرف بكوكب الشرق',
  'cheb khaled': 'مغني جزائري، من رواد موسيقى الراي',
  'cheb mami': 'مغني جزائري، من أشهر مطربي الراي',
  'don bigg': 'مغني راب مغربي، من رواد الهيب هوب العربي',
  'elgrandetoto': 'مغني راب مغربي، من أشهر فناني الهيب هوب',
  'elie saab': 'مصمم أزياء لبناني مشهور، يعمل في باريس',
  'hassan fathy': 'مهندس معماري مصري، من رواد العمارة المستدامة',
  'hicham el guerrouj': 'عداء مغربي سابق، حاصل على ميداليات أولمبية',
  'hussain al jassmi': 'مغني إماراتي مشهور، من أشهر المطربين الخليجيين',
  'ibn battuta': 'رحالة ومؤرخ مغربي، من أشهر الرحالة في التاريخ',
  'ibn khaldun': 'مؤرخ وعالم اجتماع مغربي، من رواد علم الاجتماع',
  'ibtissam tiskat': 'مغنية مغربية، من أشهر المطربات في المغرب',
  'khadija el bidaouia': 'مغنية مغربية تقليدية، من رواد الأغنية الشعبية',
  'laila lalami': 'كاتبة مغربية، تعيش في الولايات المتحدة',
  'mahmoud el khatib': 'لاعب كرة قدم مصري سابق، من أساطير الأهلي',
  'majida el roumi': 'مغنية لبنانية، من أشهر المطربات العربيات',
  'mouna fettou': 'ممثلة مغربية، من أشهر الممثلات في المغرب',
  'naguib mahfouz': 'كاتب مصري، حاصل على جائزة نوبل في الأدب',
  'nawal el saadawi': 'كاتبة وطبيبة مصرية، من أشهر الكاتبات العربيات',
  'samira said': 'مغنية مغربية، من أشهر المطربات في العالم العربي',
  'souad massi': 'مغنية جزائرية، تعيش في فرنسا',
  'tahar ben jelloun': 'كاتب مغربي، من أشهر الكتاب العرب في فرنسا',
  'tamer hosny': 'مغني وممثل مصري، من أشهر الفنانين الشباب',
  'wahbi khazri': 'لاعب كرة قدم تونسي محترف، يلعب في فرنسا',
  'yassine bounou': 'حارس مرمى مغربي محترف، يلعب في إشبيلية',
  'younes el aynaoui': 'لاعب كرة قدم مغربي سابق، من رواد الكرة المغربية',
  'youssef en nesyri': 'لاعب كرة قدم مغربي محترف، مهاجم في إشبيلية',
  
  // Additional Moroccan Celebrities
  'fatima zahra': 'مغنية مغربية، من أشهر المطربات في العالم العربي',
  'latifa raafat': 'مغنية مغربية، من أشهر المطربات في العالم العربي',
  'hassan hakmoun': 'مغني مغربي، من أشهر المطربين في العالم العربي',
  'mohammed ben attab': 'مغني مغربي، من أشهر المطربين في العالم العربي',
  'abdelkrim khattabi': 'مغني مغربي، من أشهر المطربين في العالم العربي',
  'mohammed v': 'ملك مغربي سابق، من رواد الاستقلال',
  'hassan ii': 'ملك مغربي سابق، من رواد التنمية',
  'mohammed vi': 'ملك مغربي حالياً، من رواد الإصلاح',
  
  // Additional Egyptian Celebrities
  'abdel halim hafez': 'مغني مصري أسطوري، من أشهر المطربين العرب',
  'warda al jazairia': 'مغنية لبنانية، من أشهر المطربات العربيات',
  'kadim al sahir': 'مغني عراقي، من رواد الموسيقى العربية',
  'ragheb alama': 'مغني لبناني، من أشهر المطربين العرب',
  'elissa': 'مغنية لبنانية أسطورية، من أشهر المطربين العرب',
  'haifa wehbe': 'مغنية لبنانية مشهورة، تعرف بملكة جمال العرب',
  'sherine': 'مغنية مصرية، من أشهر المطربات في العالم العربي',
  'umar khayyam': 'شاعر وفيلسوف فارسي، من رواد الأدب',
  'ahmed shawki': 'شاعر مصري، من رواد الشعر العربي الحديث',
  'taha hussein': 'كاتب مصري، من رواد الأدب العربي',
  'youssef wahbi': 'ممثل مصري، من رواد المسرح العربي',
  'adel imam': 'ممثل مصري، من أشهر الممثلين العرب',
  'ahmed helmy': 'ممثل مصري، من أشهر الممثلين الكوميديين',
  'mohamed henida': 'ممثل مصري، من أشهر الممثلين الكوميديين',
  'yousra': 'ممثلة مصرية، من أشهر الممثلات العربيات',
  'faten hamama': 'ممثلة مصرية، من أشهر الممثلات العربيات',
  'souad hosni': 'ممثلة مصرية، من أشهر الممثلات العربيات',
  
  // Additional Tunisian Celebrities
  'lotfi bouchnak': 'مغني تونسي، من رواد الموسيقى التونسية',
  'sabri mosbah': 'مغني تونسي، من رواد الموسيقى التونسية',
  'emel mathlouthi': 'مغنية تونسية، من رواد الموسيقى التونسية',
  'dhafer youssef': 'موسيقي تونسي، من رواد الموسيقى التونسية',
  'anis gharbi': 'مغني تونسي، من رواد الموسيقى التونسية',
  'sami fekri': 'مغني تونسي، من رواد الموسيقى التونسية',
  'sabah': 'مغنية لبنانية، من رواد الموسيقى العربية',
  'hassen doss': 'مغني تونسي، من رواد الموسيقى التونسية',
  
  // Additional Algerian Celebrities
  'cheb hasni': 'مغني جزائري، من رواد موسيقى الراي',
  'rachid taha': 'مغني جزائري، من رواد موسيقى الراي',
  'khaled': 'مغني جزائري، من رواد موسيقى الراي',
  'rachid ghezzal': 'لاعب كرة قدم جزائري محترف',
  'yacine brahimi': 'لاعب كرة قدم جزائري محترف',
  'sofiane feghouli': 'لاعب كرة قدم جزائري محترف',
  'ryad mahrez': 'لاعب كرة قدم جزائري محترف، يلعب في إنجلترا',
  'islam slimani': 'لاعب كرة قدم جزائري محترف',
  'abdelkader bentoumi': 'مغني جزائري، من رواد الموسيقى الجزائرية',
  'hassiba boulmerka': 'عداءة جزائرية، حاصلة على ميداليات أولمبية',
  'nouria benida merrah': 'عداءة جزائرية، حاصلة على ميداليات أولمبية',
  
  // Additional Arab Celebrities from Other Countries
  'fayrouz': 'مغنية لبنانية أسطورية، من أشهر المطربين العرب',
  'marcel khalife': 'موسيقي لبناني، من رواد الموسيقى العربية',
  'julia boutros': 'مغنية لبنانية، من أشهر المطربات العربيات',
  'georges wassouf': 'مغني سوري، من رواد الموسيقى العربية',
  'fadl shaker': 'مغني لبناني، من رواد الموسيقى العربية',
  'diana haddad': 'مغنية كويتية، من أشهر المطربات الخليجيات',
  'ahlam': 'مغنية إماراتية، من أشهر المطربات الخليجيات',
  'balqees': 'مغنية يمنية، من أشهر المطربات العربيات',
  'arwa': 'مغنية يمنية، من أشهر المطربات العربيات',
  'abdel rahman al rahbi': 'مغني يمني، من رواد الموسيقى اليمنية',
  'abou bakr salim': 'مغني يمني، من رواد الموسيقى اليمنية',
  'ahmed fathallah': 'مغني يمني، من رواد الموسيقى اليمنية',
  'mohammed abdu': 'مغني سعودي، من رواد الموسيقى السعودية',
  'talal maddah': 'مغني سعودي، من رواد الموسيقى السعودية',
  'abdel majeed abdullah': 'مغني سعودي، من رواد الموسيقى السعودية',
  'mohammed rashid': 'مغني سعودي، من رواد الموسيقى السعودية',
  'najah salam': 'مغنية سعودية، من رواد الموسيقى السعودية'
};

function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[\u064B-\u065F]/g, '')
    .replace(/[^\w\sء-ي]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

let currentQuestion = null;
let answering = false;
let timeoutId = null;
const correctUsers = new Set();

// Add this function to fetch images from Wikipedia
async function fetchImagesFromWikipedia(celebrityName) {
  try {
    // First get the page ID
    const searchResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        list: 'search',
        srsearch: celebrityName,
        format: 'json',
        origin: '*'
      }
    });
    
    if (!searchResponse.data.query.search.length) return null;
    
    const pageId = searchResponse.data.query.search[0].pageid;
    
    // Then get images from that page
    const imagesResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'query',
        prop: 'images',
        pageids: pageId,
        format: 'json',
        origin: '*'
      }
    });
    
    const images = imagesResponse.data.query.pages[pageId].images;
    if (!images || !images.length) return null;
    
    // Get actual image URLs (only for jpg/png files)
    const imageFiles = images
      .filter(img => /\.(jpe?g|png)$/i.test(img.title))
      .slice(0, 5); // Limit to 5 images
    
    if (!imageFiles.length) return null;
    
    const imageUrls = [];
    
    for (const img of imageFiles) {
      const fileInfoResponse = await axios.get('https://en.wikipedia.org/w/api.php', {
        params: {
          action: 'query',
          prop: 'imageinfo',
          iiprop: 'url',
          titles: img.title,
          format: 'json',
          origin: '*'
        }
      });
      
      const pages = fileInfoResponse.data.query.pages;
      const page = Object.values(pages)[0];
      
      if (page.imageinfo && page.imageinfo[0].url) {
        imageUrls.push(page.imageinfo[0].url);
      }
    }
    
    return imageUrls.length ? imageUrls : null;
  } catch (error) {
    console.error('Error fetching from Wikipedia:', error);
    return null;
  }
}

// Add this function to fetch images from Google (requires API key)
async function fetchImagesFromGoogle(celebrityName) {
  try {
    // You'll need to set up a Google Custom Search Engine and get API credentials
    // https://developers.google.com/custom-search/v1/overview
    const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
    const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID;
    
    const response = await axios.get('https://www.googleapis.com/customsearch/v1', {
      params: {
        key: GOOGLE_API_KEY,
        cx: GOOGLE_CSE_ID,
        q: celebrityName,
        searchType: 'image',
        num: 5 // Get 5 images
      }
    });
    
    if (!response.data.items || !response.data.items.length) return null;
    
    return response.data.items.map(item => item.link);
  } catch (error) {
    console.error('Error fetching from Google:', error);
    return null;
  }
}

// Modify the getRandomCelebrity function to include online fetching
async function getRandomCelebrity(specificName = null) {
  // If a specific name is provided, try to fetch online first
  if (specificName) {
    // Try to fetch online
    const onlineCelebrity = await getOnlineCelebrity(specificName);
    if (onlineCelebrity) {
      return onlineCelebrity;
    }
    
    // Fallback to local files if online fails
    const celebrities = fs.readdirSync('./images').filter(f => fs.statSync(`./images/${f}`).isDirectory());
    const normalizedName = specificName.toLowerCase().replace(/\s+/g, '_');
    const matchingDir = celebrities.find(dir => dir.toLowerCase() === normalizedName);
    
    if (matchingDir) {
      return getLocalCelebrity(matchingDir);
    }
    
    return null;
  }
  
  // For random selection, use the expanded celebrity list
  const popularCelebrities = [
    // Football Players
    'Leo Messi', 'Cristiano Ronaldo', 'Neymar', 'Kylian Mbappé', 'Mohamed Salah', 
    'Zinedine Zidane', 'Karim Benzema', 'Erling Haaland', 'Kevin De Bruyne', 'Virgil Van Dijk',
    
    // Moroccan Celebrities
    'Saad Lamjarred', 'Said Mouskir', 'Nancy Ajram', 'Amr Diab', 'Cheb Khaled', 'Cheb Mami',
    'Don Bigg', 'ElGrandeToto', 'Elie Saab', 'Hassan Fathy', 'Hicham El Guerrouj',
    'Hussain Al Jassmi', 'Ibn Battuta', 'Ibn Khaldun', 'Ibtissam Tiskat', 'Khadija El Bidaouia',
    'Laila Lalami', 'Mahmoud El Khatib', 'Majida El Roumi', 'Mouna Fettou', 'Naguib Mahfouz',
    'Nawal El Saadawi', 'Samira Said', 'Souad Massi', 'Tahar Ben Jelloun', 'Tamer Hosny',
    'Wahbi Khazri', 'Yassine Bounou', 'Younes El Aynaoui', 'Youssef En Nesyri',
    'Fatima Zahra', 'Latifa Raafat', 'Hassan Hakmoun', 'Mohammed Ben Attab',
    'Abdelkrim Khattabi', 'Mohammed V', 'Hassan II', 'Mohammed VI',
    
    // Egyptian Celebrities
    'Abdel Halim Hafez', 'Warda Al Jazairia', 'Kadim Al Sahir', 'Ragheb Alama',
    'Elissa', 'Haifa Wehbe', 'Sherine', 'Umar Khayyam', 'Ahmed Shawki',
    'Taha Hussein', 'Youssef Wahbi', 'Adel Imam', 'Ahmed Helmy',
    'Mohamed Henida', 'Yousra', 'Faten Hamama', 'Souad Hosni',
    
    // Tunisian Celebrities
    'Lotfi Bouchnak', 'Sabri Mosbah', 'Emel Mathlouthi', 'Dhafer Youssef',
    'Anis Gharbi', 'Sami Fekri', 'Sabah', 'Hassen Doss',
    
    // Algerian Celebrities
    'Cheb Hasni', 'Rachid Taha', 'Khaled', 'Rachid Ghezzal', 'Yacine Brahimi',
    'Sofiane Feghouli', 'Ryad Mahrez', 'Islam Slimani', 'Abdelkader Bentoumi',
    'Hassiba Boulmerka', 'Nouria Benida Merrah',
    
    // Other Arab Celebrities
    'Fairuz', 'Umm Kulthum', 'Fayrouz', 'Marcel Khalife', 'Julia Boutros',
    'Georges Wassouf', 'Fadl Shaker', 'Diana Haddad', 'Ahlam', 'Balqees',
    'Arwa', 'Abdel Rahman Al Rahbi', 'Abou Bakr Salim', 'Ahmed Fathallah',
    'Mohammed Abdu', 'Talal Maddah', 'Abdel Majeed Abdullah', 'Mohammed Rashid',
    'Najah Salam'
  ];
  
  // Pick a random celebrity from the list
  const randomCelebrity = popularCelebrities[Math.floor(Math.random() * popularCelebrities.length)];
  console.log(`🎲 Selected random celebrity: ${randomCelebrity}`);
  
  // Try to fetch online first
  const onlineCelebrity = await getOnlineCelebrity(randomCelebrity);
  
  if (onlineCelebrity) {
    return onlineCelebrity;
  }
  
  // Fallback to local files if online fails
  const celebrities = fs.readdirSync('./images').filter(f => fs.statSync(`./images/${f}`).isDirectory());
  if (celebrities.length === 0) return null;
  const chosen = celebrities[Math.floor(Math.random() * celebrities.length)];
  return getLocalCelebrity(chosen);
}

// Helper function to get celebrity from local files
function getLocalCelebrity(folderName) {
  const files = fs.readdirSync(`./images/${folderName}`).filter(f => /\.(png|jpe?g)$/i.test(f));
  if (files.length === 0) return null;

  const randomImage = files[Math.floor(Math.random() * files.length)];
  const imagePath = path.join(__dirname, 'images', folderName, randomImage);

  const normalizedFolderName = folderName.toLowerCase().replace(/_/g, ' ').trim();

  return {
    name: normalizedFolderName,
    image: imagePath,
    isLocal: true,
    aliases: aliasesMap[normalizedFolderName] || [normalizedFolderName],
  };
}

// Helper function to get celebrity from online sources
async function getOnlineCelebrity(celebrityName) {
  // Try Wikipedia first
  let imageUrls = await fetchImagesFromWikipedia(celebrityName);
  
  // If no images from Wikipedia, try Google
  if (!imageUrls || imageUrls.length === 0) {
    imageUrls = await fetchImagesFromGoogle(celebrityName);
  }
  
  if (!imageUrls || imageUrls.length === 0) return null;
  
  // Pick a random image from the results
  const randomImageUrl = imageUrls[Math.floor(Math.random() * imageUrls.length)];
  
  // Find matching aliases from our aliasesMap
  let aliases = [celebrityName.toLowerCase()];
  
  // Check if we have this celebrity in our aliasesMap
  for (const [key, value] of Object.entries(aliasesMap)) {
    if (value.includes(celebrityName.toLowerCase()) || 
        value.includes(celebrityName) || 
        key.toLowerCase() === celebrityName.toLowerCase()) {
      aliases = value; // Use all the aliases from our map
      console.log(`🎯 Found aliases for ${celebrityName}:`, aliases);
      break;
    }
  }
  
  // Remove duplicates
  aliases = [...new Set(aliases)];
  
  return {
    name: celebrityName,
    imageUrl: randomImageUrl,
    isLocal: false,
    aliases: aliases,
  };
}

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('messageCreate', async message => {
  console.log(`Message received: ${message.content} from ${message.author.tag}`);
  if (message.author.bot) return;

  const content = message.content.trim();

  if (content.toLowerCase() === `${PREFIX}مشاهير`) {
    if (answering) {
      return message.channel.send('⏳ كاين سؤال جاري، صبر شوية حتى يكمل!');
    }

    currentQuestion = await getRandomCelebrity();
    if (!currentQuestion) return message.channel.send('⚠️ ما قدرناش نلقاو صورة دابا، حاول مرة أخرى.');

    answering = true;
    correctUsers.clear();

    let embed;
    
    if (currentQuestion.isLocal) {
      // Local image handling (existing code)
      const attachment = new AttachmentBuilder(currentQuestion.image);
      embed = new EmbedBuilder()
        .setTitle('🎭 شكون هاد الشخصية؟')
        .setImage(`attachment://${path.basename(currentQuestion.image)}`)
        .setColor('Random')
        .setFooter({ text: '⏰ الوقت المتبقي: 20 ثانية' });
        
      await message.channel.send({ embeds: [embed], files: [attachment] });
    } else {
      // Online image handling
      embed = new EmbedBuilder()
        .setTitle('🎭 شكون هاد الشخصية؟')
        .setImage(currentQuestion.imageUrl)
        .setColor('Random')
        .setFooter({ text: '⏰ الوقت المتبقي: 20 ثانية' });
        
      await message.channel.send({ embeds: [embed] });
    }

    // Start live countdown timer
    let timeLeft = 20;
    const countdownInterval = setInterval(async () => {
      timeLeft--;
      if (timeLeft >= 0) {
        // Update the embed footer with new countdown time
        try {
          if (currentQuestion.isLocal) {
            // For local images, we need to edit the original message
            const updatedEmbed = new EmbedBuilder()
              .setTitle('🎭 شكون هاد الشخصية؟')
              .setImage(`attachment://${path.basename(currentQuestion.image)}`)
              .setColor('Random')
              .setFooter({ text: `⏰ الوقت المتبقي: ${timeLeft} ثانية` });
            
            // Find and edit the original message
            const messages = await message.channel.messages.fetch({ limit: 10 });
            const questionMessage = messages.find(msg => 
              msg.embeds.length > 0 && 
              msg.embeds[0].title === '🎭 شكون هاد الشخصية؟'
            );
            
            if (questionMessage) {
              await questionMessage.edit({ embeds: [updatedEmbed] });
            }
          } else {
            // For online images, update the embed
            embed.setFooter({ text: `⏰ الوقت المتبقي: ${timeLeft} ثانية` });
            
            // Find and edit the original message
            const messages = await message.channel.messages.fetch({ limit: 10 });
            const questionMessage = messages.find(msg => 
              msg.embeds.length > 0 && 
              msg.embeds[0].title === '🎭 شكون هاد الشخصية؟'
            );
            
            if (questionMessage) {
              await questionMessage.edit({ embeds: [embed] });
            }
          }
        } catch (error) {
          console.error('Error updating countdown:', error);
        }
      } else {
        clearInterval(countdownInterval);
      }
    }, 1000);

    // Store the countdown interval in currentQuestion for later clearing
    currentQuestion.countdownInterval = countdownInterval;

    timeoutId = setTimeout(() => {
      if (answering) {
        answering = false;
        clearInterval(countdownInterval);
        
        // Get Arabic name and description
        const arabicName = arabicNames[currentQuestion.name.toLowerCase()] || arabicNames[currentQuestion.name] || currentQuestion.name;
        const description = celebrityDescriptions[currentQuestion.name.toLowerCase()] || celebrityDescriptions[currentQuestion.name] || 'شخصية مشهورة';
        
        // Create beautiful embed for timeout
        const timeoutEmbed = new EmbedBuilder()
          .setTitle('⏰ انتهى الوقت!')
          .setDescription(`**${currentQuestion.name} (${arabicName})**`)
          .addFields(
            { name: '📝 الوصف', value: description, inline: false },
            { name: '🎯 الجواب الصحيح', value: currentQuestion.name, inline: true }
          )
          .setColor('#FF6B6B')
          .setThumbnail('https://cdn.discordapp.com/emojis/⏰.png')
          .setTimestamp()
          .setFooter({ text: '🎭 لعبة المشاهير - Machahir Bot' });
        
        message.channel.send({ embeds: [timeoutEmbed] });
        currentQuestion = null;
        correctUsers.clear();
      }
    }, 20000);

    return;
  }

  if (answering && currentQuestion) {
    const userAnswer = normalizeText(content);

    // إذا اللاعب جاوب صح من قبل، مانردش عليه
    if (correctUsers.has(message.author.id)) return;

    const answerAccepted = currentQuestion.aliases.some(alias => {
      const aliasNormalized = normalizeText(alias);
      const similarity = stringSimilarity.compareTwoStrings(userAnswer, aliasNormalized);
      return similarity >= 0.7;
    });

if (answerAccepted) {
  answering = false;
  clearTimeout(timeoutId);
  // Clear countdown interval if it exists
  if (currentQuestion && currentQuestion.countdownInterval) {
    clearInterval(currentQuestion.countdownInterval);
  }
  correctUsers.add(message.author.id);

  // Get Arabic name and description
  const arabicName = arabicNames[currentQuestion.name.toLowerCase()] || arabicNames[currentQuestion.name] || currentQuestion.name;
  const description = celebrityDescriptions[currentQuestion.name.toLowerCase()] || celebrityDescriptions[currentQuestion.name] || 'شخصية مشهورة';
  
  // Create beautiful embed for correct answer
  const correctEmbed = new EmbedBuilder()
    .setTitle('🎉 إجابة صحيحة!')
    .setDescription(`**${currentQuestion.name} (${arabicName})**`)
    .addFields(
      { name: '📝 الوصف', value: description, inline: false },
      { name: '👤 المجيب', value: `<@${message.author.id}>`, inline: true }
    )
    .setColor('#00FF00')
    .setThumbnail('https://cdn.discordapp.com/emojis/✅.png')
    .setTimestamp()
    .setFooter({ text: '🎭 لعبة المشاهير - Machahir Bot' });
  
  await message.reply({ embeds: [correctEmbed] });
  currentQuestion = null;
  correctUsers.clear();
} 
  } else if (content.toLowerCase().startsWith(`${PREFIX}شخصية`)) { // Combined the second messageCreate handler here
    const celebrityName = content.slice(PREFIX.length + 'شخصية'.length).trim();
    
    if (!celebrityName) {
      return message.channel.send('❓ عطيني سميت الشخصية لي بغيتي نوريك ليها.');
    }
    
    const loadingMsg = await message.channel.send('🔍 كانقلب على الشخصية...');
    
    const celebrity = await getRandomCelebrity(celebrityName);
    
    if (!celebrity) {
      return loadingMsg.edit('❌ ماقدرتش نلقى هاد الشخصية. جرب شي سمية أخرى.');
    }
    
    let embed;
    
    if (celebrity.isLocal) {
      // Local image
      const attachment = new AttachmentBuilder(celebrity.image);
      embed = new EmbedBuilder()
        .setTitle(`🎭 ${celebrity.name}`)
        .setImage(`attachment://${path.basename(celebrity.image)}`)
        .setColor('Random');
        
      await loadingMsg.delete();
      await message.channel.send({ embeds: [embed], files: [attachment] });
    } else {
      // Online image
      embed = new EmbedBuilder()
        .setTitle(`🎭 ${celebrity.name}`)
        .setImage(celebrity.imageUrl)
        .setColor('Random');
        
      await loadingMsg.delete();
      await message.channel.send({ embeds: [embed] });
    }
  }
});

client.login(process.env.TOKEN);
