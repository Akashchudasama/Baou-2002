// English / ગુજરાતી interface switch.
// Only the interface (buttons, labels, headings the site itself writes) is
// translated here. Course content stays in English; folio titles and
// introductions have their own Gujarati fields, edited in the admin console.
// Translations should be reviewed by the department before launch.

const KEY = 'baou-eng-lang';

const GU = {
  // shell
  Home: 'મુખપૃષ્ઠ',
  Notices: 'સૂચનાઓ',
  Theme: 'રંગરૂપ',
  'Colour theme': 'રંગરૂપ',
  'Your choice is remembered on this device.': 'તમારી પસંદગી આ ઉપકરણ પર યાદ રહેશે.',
  'Reading tools': 'વાંચન સાધનો',
  'Text size': 'અક્ષરનું કદ',
  Smaller: 'નાનું',
  Normal: 'સામાન્ય',
  Larger: 'મોટું',
  Largest: 'સૌથી મોટું',
  'Listen to this page': 'આ પાનું સાંભળો',
  Pause: 'થોભો',
  Resume: 'ફરી શરૂ કરો',
  Stop: 'બંધ કરો',
  'Read-aloud is not available in this browser.': 'આ બ્રાઉઝરમાં વાંચી સંભળાવવાની સુવિધા ઉપલબ્ધ નથી.',
  Experience: 'અનુભવ',
  Automatic: 'આપમેળે',
  'Rich 3D': 'સમૃદ્ધ 3D',
  Light: 'હળવું',
  'Data saver': 'ડેટા બચત',
  'Saved for offline reading': 'ઑફલાઇન વાંચન માટે સાચવ્યું',
  'You are offline — showing pages saved on this device. They will refresh when the signal returns.':
    'તમે ઑફલાઇન છો — આ ઉપકરણ પર સાચવેલાં પાનાં બતાવીએ છીએ. નેટવર્ક પાછું આવતાં તે અપડેટ થશે.',
  'Skip to content': 'મુખ્ય સામગ્રી પર જાઓ',
  // home
  'Notice Board': 'સૂચના ફલક',
  'No notices at present.': 'હાલમાં કોઈ સૂચના નથી.',
  'Word of the Day': 'આજનો શબ્દ',
  'Today in Literature': 'સાહિત્યમાં આજે',
  'From the reading room': 'વાચનખંડમાંથી',
  Gujarati: 'ગુજરાતી',
  Hindi: 'હિન્દી',
  Example: 'ઉદાહરણ',
  days: 'દિવસ',
  day: 'દિવસ',
  'Which programme suits me?': 'મારા માટે કયો અભ્યાસક્રમ યોગ્ય છે?',
  'Start the quiz': 'પ્રશ્નોત્તરી શરૂ કરો',
  'Question': 'પ્રશ્ન',
  of: '/',
  Back: 'પાછળ',
  'Start again': 'ફરી શરૂ કરો',
  'You might begin with': 'તમે આનાથી શરૂઆત કરી શકો',
  'Open on the shelf': 'પુસ્તકછાજલી પર ખોલો',
  'Read the full message': 'સંપૂર્ણ સંદેશ વાંચો',
  'The Literary Pantheon': 'સાહિત્યિક દેવાલય',
  'Canonical and vernacular voices in conversation. Select a portrait to open its marginalia.':
    'શાસ્ત્રીય અને દેશી ભાષાના અવાજોનો સંવાદ. હાંસિયાની નોંધ ખોલવા કોઈ ચિત્ર પસંદ કરો.',
  // programmes
  'Choose a book to open it.': 'ખોલવા માટે પુસ્તક પસંદ કરો.',
  '← Back to the shelf': '← પુસ્તકછાજલી પર પાછા',
  'Useful links': 'ઉપયોગી લિંક',
  'SLM & study material': 'એસ.એલ.એમ. અને અભ્યાસ સામગ્રી',
  Results: 'પરિણામ',
  'At a glance': 'એક નજરે',
  'What you’ll study': 'તમે શું ભણશો',
  'Our learners': 'અમારા અધ્યેતાઓ',
  'Where it can lead': 'આગળની તકો',
  Page: 'પાનું',
  '← Previous': '← પાછળ',
  'Next →': 'આગળ →',
  'Close the book': 'પુસ્તક બંધ કરો',
  Level: 'સ્તર',
  Duration: 'સમયગાળો',
  Medium: 'માધ્યમ',
  Eligibility: 'પાત્રતા',
  Fees: 'ફી',
  Semester: 'સત્ર',
  'All learners': 'કુલ અધ્યેતાઓ',
  Female: 'સ્ત્રી',
  Male: 'પુરુષ',
  Transgender: 'ટ્રાન્સજેન્ડર',
  'General pathways. Eligibility for each depends on the norms of the respective body or employer.':
    'સામાન્ય માર્ગો. દરેક માટેની પાત્રતા સંબંધિત સંસ્થા કે નોકરીદાતાના નિયમો પર આધારિત છે.',
  // SLM
  'Go to the LMS': 'એલ.એમ.એસ. પર જાઓ',
  'All programmes': 'બધા અભ્યાસક્રમો',
  'All semesters': 'બધાં સત્રો',
  'Search by title or course code': 'શીર્ષક કે કોર્સ કોડથી શોધો',
  Assignments: 'સ્વાધ્યાય',
  'Show more': 'વધુ બતાવો',
  'Save offline': 'ઑફલાઇન સાચવો',
  // faculty & research
  'View profile →': 'પરિચય જુઓ →',
  'Research guides': 'સંશોધન માર્ગદર્શકો',
  'Our booklets': 'અમારી પુસ્તિકાઓ',
  'PhDs completed': 'પીએચ.ડી. પૂર્ણ',
  // results
  'Open the results portal': 'પરિણામ પોર્ટલ ખોલો',
  'Top achievers': 'શ્રેષ્ઠ વિદ્યાર્થીઓ',
  'The top five learners of each programme, published with their consent.':
    'દરેક અભ્યાસક્રમના પ્રથમ પાંચ અધ્યેતાઓ — તેમની સંમતિથી પ્રકાશિત.',
  'Result notices': 'પરિણામ સૂચનાઓ',
  // inkwell
  'Ask the Muse': 'મ્યુઝને પૂછો',
  'Study companion': 'અભ્યાસ સાથી',
  'Ask about a programme, unit or text…': 'અભ્યાસક્રમ, એકમ કે કૃતિ વિશે પૂછો…',
  Ask: 'પૂછો',
  'The Muse': 'મ્યુઝ',
  'Clear conversation': 'વાતચીત સાફ કરો',
  Close: 'બંધ કરો',
  'Answers draw on the department’s published material. For official decisions, rely on university notices.':
    'જવાબો વિભાગની પ્રકાશિત સામગ્રી પર આધારિત છે. અધિકૃત નિર્ણયો માટે યુનિવર્સિટીની સૂચનાઓ જ માન્ય ગણો.',
  // helpdesk
  'Raise a query': 'પ્રશ્ન નોંધાવો',
  'Track a ticket': 'ટિકિટની સ્થિતિ જુઓ',
  'Full name': 'પૂરું નામ',
  'Enrolment number': 'નોંધણી નંબર (Enrolment No.)',
  'Registered email': 'નોંધાયેલ ઈમેલ',
  'The email you gave the university. Replies are linked to it.': 'યુનિવર્સિટીમાં આપેલો ઈમેલ. જવાબ આ ઈમેલ સાથે જોડાયેલો રહેશે.',
  'Mobile number': 'મોબાઇલ નંબર',
  Programme: 'અભ્યાસક્રમ',
  Category: 'વિભાગ',
  Subject: 'વિષય',
  'Your query': 'તમારો પ્રશ્ન',
  'Submit query': 'પ્રશ્ન મોકલો',
  'Sending…': 'મોકલાઈ રહ્યું છે…',
  'Ticket reference': 'ટિકિટ નંબર',
  'Email used': 'વાપરેલો ઈમેલ',
  'Check status': 'સ્થિતિ જુઓ',
  'Department office': 'વિભાગ કાર્યાલય',
  'I agree that the department may use these details only to answer this query. Name, email, mobile and enrolment number are removed six months after the query is closed.':
    'હું સંમત છું કે વિભાગ આ વિગતોનો ઉપયોગ ફક્ત આ પ્રશ્નનો જવાબ આપવા માટે કરશે. પ્રશ્ન બંધ થયાના છ મહિના પછી નામ, ઈમેલ, મોબાઇલ અને નોંધણી નંબર દૂર કરવામાં આવે છે.',
  'Please enter your enrolment number.': 'કૃપા કરી તમારો નોંધણી નંબર લખો.',
  'Please enter a 10-digit mobile number.': 'કૃપા કરી 10 અંકનો મોબાઇલ નંબર લખો.',
  'Your query has been received. Please note your ticket reference:': 'તમારો પ્રશ્ન મળી ગયો છે. કૃપા કરી ટિકિટ નંબર નોંધી લો:',
  'Use it with your registered email to check the reply.': 'જવાબ જોવા માટે આ નંબર અને નોંધાયેલ ઈમેલનો ઉપયોગ કરો.',
  'Please tick the consent box.': 'કૃપા કરી સંમતિના ખાનામાં ટિક કરો.',
  resolved: 'ઉકેલાયા',
  'Queries resolved so far': 'અત્યાર સુધી ઉકેલાયેલા પ્રશ્નો',
  'queries have been answered and closed by the department.': 'પ્રશ્નોના વિભાગે જવાબ આપી બંધ કર્યા છે.',
  'Totals only. No learner’s details are ever shown here.': 'ફક્ત કુલ સંખ્યા. અહીં કોઈ વિદ્યાર્થીની વિગતો ક્યારેય દર્શાવાતી નથી.',
  // gallery & alumni
  'Events & Gallery': 'કાર્યક્રમો અને ગેલેરી',
  Alumni: 'પૂર્વ વિદ્યાર્થીઓ',
  'Photographs will appear here after the next event.': 'આગામી કાર્યક્રમ પછી અહીં ફોટા દેખાશે.',
  'Alumni stories will appear here soon.': 'પૂર્વ વિદ્યાર્થીઓની વાતો ટૂંક સમયમાં અહીં દેખાશે.',
  Previous: 'પાછળ',
  'Show all': 'બધું બતાવો',
  Next: 'આગળ',
  // national days
  'Happy Republic Day': 'પ્રજાસત્તાક દિનની શુભકામનાઓ',
  'Happy Independence Day': 'સ્વાતંત્ર્ય દિનની શુભકામનાઓ',
};

export function getLang() {
  try {
    return localStorage.getItem(KEY) === 'gu' ? 'gu' : 'en';
  } catch {
    return 'en';
  }
}

export function setLang(lang) {
  try {
    localStorage.setItem(KEY, lang === 'gu' ? 'gu' : 'en');
  } catch { /* ignore */ }
}

const lang = getLang();

/** Translates an interface string; falls back to English. */
export function t(text) {
  return lang === 'gu' && GU[text] ? GU[text] : text;
}

/** Picks the Gujarati field of a row when the interface is Gujarati and it is filled. */
export function localized(row, field) {
  if (lang === 'gu' && row?.[`${field}_gu`]) return row[`${field}_gu`];
  return row?.[field];
}

export const isGujarati = () => lang === 'gu';
