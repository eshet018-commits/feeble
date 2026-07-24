import { LanguageCode } from '@/constants/translations';

export interface HelpFaq {
  question: string;
  answer: string;
}

export interface HelpContent {
  title: string;
  subtitle: string;
  faqTitle: string;
  contactTitle: string;
  contactDescription: string;
  faqs: HelpFaq[];
}

const en: HelpContent = {
  title: 'Help & Support',
  subtitle: 'Find answers to common questions or reach out to us directly',
  faqTitle: 'Frequently Asked Questions',
  contactTitle: 'Still need help?',
  contactDescription: "Send us an email and we'll get back to you as soon as possible. We're here to help!",
  faqs: [
    {
      question: 'What is Feeble?',
      answer:
        'Feeble is a group event management app. You can create or join groups, organize events with your group members, set reminders, and manage recurring events — all in one place.',
    },
    {
      question: 'How do I create a group?',
      answer:
        'Tap the blue "+" button on the home screen and select "Create Group." Give your group a name and optional description. You\'ll automatically become the group admin and a unique invite code will be generated for others to join.',
    },
    {
      question: 'How do I join a group?',
      answer:
        'Tap the person-with-plus icon on the home screen, then enter the invite code shared by the group admin. If the code is valid, you\'ll be added to the group instantly.',
    },
    {
      question: 'How do I invite others to my group?',
      answer:
        'Open your group, tap the invite button (usually at the top of the group screen), and share the invite code with your friends via any messaging app. Anyone with the code can join your group.',
    },
    {
      question: 'How do I create an event?',
      answer:
        'Inside a group, tap the "+" button to create a new event. You can set a title, description, start and end time, location, category, reminders, and even make it repeat daily, weekly, or monthly.',
    },
    {
      question: 'How do reminders work?',
      answer:
        'When creating or editing an event, you can add one or more reminder times (e.g. 10 minutes before, 1 hour before). The app will send you a push notification at each reminder time so you never miss an event.',
    },
    {
      question: 'What are recurring events?',
      answer:
        'You can set events to repeat daily, weekly, or monthly. Optionally set an end date so the event stops repeating after a certain date. The recurring instances show up automatically in your group calendar.',
    },
    {
      question: 'How do I change my password or email?',
      answer:
        'Go to your Profile (the person icon in the top-right of the home screen). Scroll down to find "Change Password" and "Change Email" sections. You\'ll need to enter your current password to confirm the change.',
    },
    {
      question: 'What do admin and viewer roles mean?',
      answer:
        'Admins can create events, edit group settings, invite members, promote/demote members, and delete the group. Viewers can see events and members but cannot make changes. Only the original group creator can demote other admins.',
    },
    {
      question: 'How do I leave a group?',
      answer:
        'Open the group and look for the settings or leave option. Note: if you\'re the group admin, you cannot leave — you\'ll need to delete the group or transfer admin rights first.',
    },
    {
      question: 'How do I delete a group?',
      answer:
        'Only the group admin can delete a group. Open the group, go to settings, and select "Delete Group." This will remove the group and all its events permanently — this action cannot be undone.',
    },
    {
      question: 'What happens when I sign out?',
      answer:
        'When you sign out, you\'ll be taken back to the sign-in screen. If you had "Remember Me" checked when signing in, you\'ll stay signed in even after closing the app. If unchecked, signing out or closing the app will require you to sign in again.',
    },
  ],
};

const am: HelpContent = {
  title: 'እገዛ እና ድጋፍ',
  subtitle: 'ለተለመዱ ጥያቄዎች መልስ ያግኙ ወይም በቀጥታ ያግኙን',
  faqTitle: 'በተደጋጋሚ የሚጠየቁ ጥያቄዎች',
  contactTitle: 'አሁንም እገዛ ይፈልጋሉ?',
  contactDescription: 'ኢሜይል ይላኩልን እና በተቻለ ፍጥነት እንመልስልዎታለን። ለመርዳት ዝግጁ ነን!',
  faqs: [
    {
      question: 'Feeble ምንድን ነው?',
      answer:
        'Feeble የቡድን ዝግጅት አስተዳደር መተግበሪያ ነው። ቡድኖችን መፍጠር ወይም መቀላቀል፣ ከቡድን አባላትዎ ጋር ዝግጅቶችን ማደራጀት፣ ማስታወሻዎችን ማዘጋጀት እና ተደጋጋሚ ዝግጅቶችን ማስተዳደር ይችላሉ — ሁሉም በአንድ ቦታ።',
    },
    {
      question: 'ቡድን እንዴት እፈጥራለሁ?',
      answer:
        'በመነሻ ገጹ ላይ ያለውን ሰማያዊ «+» አዝራር ይንኩ እና «ቡድን ፍጠር» ይምረጡ። ለቡድንዎ ስም እና አማራጭ መግለጫ ይስጡ። በራስ-ሰር የቡድኑ አስተዳዳሪ ይሆናሉ እና ሌሎች እንዲቀላቀሉ ልዩ የግብዣ ኮድ ይፈጠራል።',
    },
    {
      question: 'ቡድን እንዴት እቀላቀላለሁ?',
      answer:
        'በመነሻ ገጹ ላይ ያለውን የሰው-ከመደመር ምልክት ይንኩ፣ ከዚያ በቡድን አስተዳዳሪው የተጋራውን የግብዣ ኮድ ያስገቡ። ኮዱ ትክክል ከሆነ ወዲያውኑ ወደ ቡድኑ ይታከላሉ።',
    },
    {
      question: 'ሌሎችን ወደ ቡድኔ እንዴት እጋብዛለሁ?',
      answer:
        'ቡድንዎን ይክፈቱ፣ የግብዣ አዝራሩን ይንኩ (አብዛኛውን ጊዜ በቡድኑ ገጽ አናት ላይ) እና የግብዣ ኮዱን በማንኛውም የመልእክት መተግበሪያ ለጓደኞችዎ ያጋሩ። ኮዱ ያለው ማንኛውም ሰው ቡድንዎን መቀላቀል ይችላል።',
    },
    {
      question: 'ዝግጅት እንዴት እፈጥራለሁ?',
      answer:
        'በቡድን ውስጥ አዲስ ዝግጅት ለመፍጠር «+» አዝራሩን ይንኩ። ርዕስ፣ መግለጫ፣ የመጀመሪያ እና የመጨረሻ ሰዓት፣ ቦታ፣ ምድብ፣ ማስታወሻዎች ማዘጋጀት እና በየቀኑ፣ በየሳምንቱ ወይም በየወሩ እንዲደገም ማድረግ ይችላሉ።',
    },
    {
      question: 'ማስታወሻዎች እንዴት ይሰራሉ?',
      answer:
        'ዝግጅት ሲፈጥሩ ወይም ሲያርትዑ አንድ ወይም ከዚያ በላይ የማስታወሻ ጊዜዎችን ማከል ይችላሉ (ለምሳሌ 10 ደቂቃ በፊት፣ 1 ሰዓት በፊት)። መተግበሪያው በእያንዳንዱ የማስታወሻ ጊዜ የግፊት ማሳወቂያ ይልክልዎታል፤ ስለዚህ ዝግጅት በጭራሽ አያመልጥዎትም።',
    },
    {
      question: 'ተደጋጋሚ ዝግጅቶች ምንድን ናቸው?',
      answer:
        'ዝግጅቶች በየቀኑ፣ በየሳምንቱ ወይም በየወሩ እንዲደገሙ ማዘጋጀት ይችላሉ። እንደ አማራጭ የመጨረሻ ቀን ያዘጋጁ፤ ዝግጅቱ ከተወሰነ ቀን በኋላ መደገም ያቆማል። ተደጋጋሚ ዝግጅቶች በቡድንዎ የቀን መቁጠሪያ ውስጥ በራስ-ሰር ይታያሉ።',
    },
    {
      question: 'የይለፍ ቃሌን ወይም ኢሜይሌን እንዴት እቀይራለሁ?',
      answer:
        'ወደ መገለጫዎ ይሂዱ (በመነሻ ገጹ ላይኛው ቀኝ ጥግ ያለው የሰው ምልክት)። ወደ ታች ይሸብልሉ እና «የይለፍ ቃል ቀይር» እና «ኢሜይል ቀይር» ክፍሎችን ያግኙ። ለውጡን ለማረጋገጥ የአሁኑን የይለፍ ቃልዎን ማስገባት ያስፈልግዎታል።',
    },
    {
      question: 'የአስተዳዳሪ እና የተመልካች ሚናዎች ምን ማለት ናቸው?',
      answer:
        'አስተዳዳሪዎች ዝግጅቶችን መፍጠር፣ የቡድን ቅንብሮችን ማርትዕ፣ አባላትን መጋበዝ፣ አባላትን ማሳደግ/ማውረድ እና ቡድኑን መሰረዝ ይችላሉ። ተመልካቾች ዝግጅቶችን እና አባላትን ማየት ይችላሉ ግን ለውጦችን ማድረግ አይችሉም። ሌሎች አስተዳዳሪዎችን ማውረድ የሚችለው የመጀመሪያው የቡድን ፈጣሪ ብቻ ነው።',
    },
    {
      question: 'ቡድን እንዴት እለቃለሁ?',
      answer:
        'ቡድኑን ይክፈቱ እና የቅንብሮች ወይም የመልቀቅ አማራጭ ይፈልጉ። ማሳሰቢያ፦ የቡድኑ አስተዳዳሪ ከሆኑ መልቀቅ አይችሉም — በመጀመሪያ ቡድኑን መሰረዝ ወይም የአስተዳዳሪ መብቶችን ማስተላለፍ ያስፈልግዎታል።',
    },
    {
      question: 'ቡድን እንዴት እሰርዛለሁ?',
      answer:
        'ቡድን መሰረዝ የሚችለው የቡድኑ አስተዳዳሪ ብቻ ነው። ቡድኑን ይክፈቱ፣ ወደ ቅንብሮች ይሂዱ እና «ቡድን ሰርዝ» ይምረጡ። ይህ ቡድኑን እና ሁሉንም ዝግጅቶቹን በቋሚነት ያስወግዳል — ይህ ተግባር መመለስ አይቻልም።',
    },
    {
      question: 'ስወጣ ምን ይሆናል?',
      answer:
        'ሲወጡ ወደ መግቢያ ገጹ ይመለሳሉ። ሲገቡ «አስታውሰኝ» ምልክት አድርገው ከነበረ መተግበሪያውን ከዘጉ በኋላም ገብተው ይቆያሉ። ካልተመረጠ፣ መውጣት ወይም መተግበሪያውን መዝጋት እንደገና እንዲገቡ ይጠይቅዎታል።',
    },
  ],
};

const es: HelpContent = {
  title: 'Ayuda y soporte',
  subtitle: 'Encuentra respuestas a preguntas comunes o contáctanos directamente',
  faqTitle: 'Preguntas frecuentes',
  contactTitle: '¿Aún necesitas ayuda?',
  contactDescription: 'Envíanos un correo y te responderemos lo antes posible. ¡Estamos aquí para ayudarte!',
  faqs: [
    {
      question: '¿Qué es Feeble?',
      answer:
        'Feeble es una app de gestión de eventos en grupo. Puedes crear o unirte a grupos, organizar eventos con los miembros de tu grupo, configurar recordatorios y gestionar eventos recurrentes, todo en un solo lugar.',
    },
    {
      question: '¿Cómo creo un grupo?',
      answer:
        'Toca el botón azul "+" en la pantalla de inicio y selecciona "Crear grupo". Dale un nombre a tu grupo y una descripción opcional. Te convertirás automáticamente en el admin del grupo y se generará un código de invitación único para que otros se unan.',
    },
    {
      question: '¿Cómo me uno a un grupo?',
      answer:
        'Toca el icono de persona con un más en la pantalla de inicio y luego ingresa el código de invitación compartido por el admin del grupo. Si el código es válido, serás añadido al grupo al instante.',
    },
    {
      question: '¿Cómo invito a otros a mi grupo?',
      answer:
        'Abre tu grupo, toca el botón de invitar (normalmente en la parte superior de la pantalla del grupo) y comparte el código de invitación con tus amigos por cualquier app de mensajería. Cualquiera con el código puede unirse a tu grupo.',
    },
    {
      question: '¿Cómo creo un evento?',
      answer:
        'Dentro de un grupo, toca el botón "+" para crear un nuevo evento. Puedes establecer un título, descripción, hora de inicio y fin, ubicación, categoría, recordatorios e incluso hacer que se repita diaria, semanal o mensualmente.',
    },
    {
      question: '¿Cómo funcionan los recordatorios?',
      answer:
        'Al crear o editar un evento, puedes añadir uno o más horarios de recordatorio (ej. 10 minutos antes, 1 hora antes). La app te enviará una notificación push en cada horario de recordatorio para que nunca te pierdas un evento.',
    },
    {
      question: '¿Qué son los eventos recurrentes?',
      answer:
        'Puedes configurar eventos para que se repitan diaria, semanal o mensualmente. Opcionalmente establece una fecha de fin para que el evento deje de repetirse. Las instancias recurrentes aparecen automáticamente en el calendario de tu grupo.',
    },
    {
      question: '¿Cómo cambio mi contraseña o correo?',
      answer:
        'Ve a tu Perfil (el icono de persona arriba a la derecha de la pantalla de inicio). Desplázate hacia abajo para encontrar las secciones "Cambiar contraseña" y "Cambiar correo". Deberás ingresar tu contraseña actual para confirmar el cambio.',
    },
    {
      question: '¿Qué significan los roles de admin y espectador?',
      answer:
        'Los admins pueden crear eventos, editar los ajustes del grupo, invitar miembros, promover/degradar miembros y eliminar el grupo. Los espectadores pueden ver eventos y miembros, pero no hacer cambios. Solo el creador original del grupo puede degradar a otros admins.',
    },
    {
      question: '¿Cómo salgo de un grupo?',
      answer:
        'Abre el grupo y busca la opción de ajustes o salir. Nota: si eres el admin del grupo, no puedes salir; primero deberás eliminar el grupo o transferir los derechos de admin.',
    },
    {
      question: '¿Cómo elimino un grupo?',
      answer:
        'Solo el admin del grupo puede eliminar un grupo. Abre el grupo, ve a ajustes y selecciona "Eliminar grupo". Esto eliminará el grupo y todos sus eventos permanentemente; esta acción no se puede deshacer.',
    },
    {
      question: '¿Qué pasa cuando cierro sesión?',
      answer:
        'Al cerrar sesión, volverás a la pantalla de inicio de sesión. Si marcaste "Recuérdame" al iniciar sesión, seguirás conectado incluso tras cerrar la app. Si no, cerrar sesión o cerrar la app requerirá que inicies sesión de nuevo.',
    },
  ],
};

const fr: HelpContent = {
  title: 'Aide et assistance',
  subtitle: 'Trouvez des réponses aux questions fréquentes ou contactez-nous directement',
  faqTitle: 'Questions fréquentes',
  contactTitle: "Besoin d'aide supplémentaire ?",
  contactDescription: 'Envoyez-nous un e-mail et nous vous répondrons dès que possible. Nous sommes là pour vous aider !',
  faqs: [
    {
      question: "Qu'est-ce que Feeble ?",
      answer:
        "Feeble est une app de gestion d'événements de groupe. Vous pouvez créer ou rejoindre des groupes, organiser des événements avec les membres, définir des rappels et gérer des événements récurrents — le tout au même endroit.",
    },
    {
      question: 'Comment créer un groupe ?',
      answer:
        "Touchez le bouton bleu « + » sur l'écran d'accueil et sélectionnez « Créer un groupe ». Donnez un nom à votre groupe et une description facultative. Vous devenez automatiquement l'admin du groupe et un code d'invitation unique est généré pour que d'autres puissent rejoindre.",
    },
    {
      question: 'Comment rejoindre un groupe ?',
      answer:
        "Touchez l'icône personne-avec-plus sur l'écran d'accueil, puis saisissez le code d'invitation partagé par l'admin du groupe. Si le code est valide, vous serez ajouté au groupe instantanément.",
    },
    {
      question: "Comment inviter d'autres personnes dans mon groupe ?",
      answer:
        "Ouvrez votre groupe, touchez le bouton d'invitation (généralement en haut de l'écran du groupe) et partagez le code d'invitation avec vos amis via n'importe quelle app de messagerie. Toute personne ayant le code peut rejoindre votre groupe.",
    },
    {
      question: 'Comment créer un événement ?',
      answer:
        "Dans un groupe, touchez le bouton « + » pour créer un nouvel événement. Vous pouvez définir un titre, une description, les heures de début et de fin, un lieu, une catégorie, des rappels, et même le faire se répéter quotidiennement, chaque semaine ou chaque mois.",
    },
    {
      question: 'Comment fonctionnent les rappels ?',
      answer:
        "Lors de la création ou modification d'un événement, vous pouvez ajouter un ou plusieurs rappels (ex. 10 minutes avant, 1 heure avant). L'app vous enverra une notification push à chaque rappel pour ne jamais manquer un événement.",
    },
    {
      question: 'Que sont les événements récurrents ?',
      answer:
        "Vous pouvez configurer des événements pour se répéter quotidiennement, chaque semaine ou chaque mois. Définissez éventuellement une date de fin pour arrêter la répétition. Les occurrences récurrentes apparaissent automatiquement dans le calendrier de votre groupe.",
    },
    {
      question: 'Comment changer mon mot de passe ou e-mail ?',
      answer:
        "Allez dans votre Profil (l'icône personne en haut à droite de l'écran d'accueil). Faites défiler pour trouver les sections « Changer le mot de passe » et « Changer l'e-mail ». Vous devrez saisir votre mot de passe actuel pour confirmer le changement.",
    },
    {
      question: 'Que signifient les rôles admin et spectateur ?',
      answer:
        "Les admins peuvent créer des événements, modifier les paramètres du groupe, inviter des membres, promouvoir/rétrograder des membres et supprimer le groupe. Les spectateurs peuvent voir les événements et les membres mais pas faire de changements. Seul le créateur original du groupe peut rétrograder d'autres admins.",
    },
    {
      question: 'Comment quitter un groupe ?',
      answer:
        "Ouvrez le groupe et cherchez l'option paramètres ou quitter. Remarque : si vous êtes l'admin du groupe, vous ne pouvez pas quitter — vous devrez d'abord supprimer le groupe ou transférer les droits d'admin.",
    },
    {
      question: 'Comment supprimer un groupe ?',
      answer:
        "Seul l'admin du groupe peut supprimer un groupe. Ouvrez le groupe, allez dans les paramètres et sélectionnez « Supprimer le groupe ». Cela supprimera le groupe et tous ses événements définitivement — cette action est irréversible.",
    },
    {
      question: 'Que se passe-t-il quand je me déconnecte ?',
      answer:
        "En vous déconnectant, vous revenez à l'écran de connexion. Si vous aviez coché « Se souvenir de moi », vous resterez connecté même après avoir fermé l'app. Sinon, vous devrez vous reconnecter.",
    },
  ],
};

const de: HelpContent = {
  title: 'Hilfe & Support',
  subtitle: 'Finde Antworten auf häufige Fragen oder kontaktiere uns direkt',
  faqTitle: 'Häufig gestellte Fragen',
  contactTitle: 'Brauchst du weitere Hilfe?',
  contactDescription: 'Schick uns eine E-Mail und wir melden uns so schnell wie möglich. Wir helfen gerne!',
  faqs: [
    {
      question: 'Was ist Feeble?',
      answer:
        'Feeble ist eine App zur Verwaltung von Gruppenereignissen. Du kannst Gruppen erstellen oder beitreten, Ereignisse mit deinen Gruppenmitgliedern organisieren, Erinnerungen einstellen und wiederkehrende Ereignisse verwalten — alles an einem Ort.',
    },
    {
      question: 'Wie erstelle ich eine Gruppe?',
      answer:
        'Tippe auf den blauen „+"-Button auf dem Startbildschirm und wähle „Gruppe erstellen". Gib deiner Gruppe einen Namen und optional eine Beschreibung. Du wirst automatisch Gruppen-Admin und ein einzigartiger Einladungscode wird generiert, damit andere beitreten können.',
    },
    {
      question: 'Wie trete ich einer Gruppe bei?',
      answer:
        'Tippe auf das Person-mit-Plus-Symbol auf dem Startbildschirm und gib den vom Gruppen-Admin geteilten Einladungscode ein. Ist der Code gültig, wirst du sofort zur Gruppe hinzugefügt.',
    },
    {
      question: 'Wie lade ich andere in meine Gruppe ein?',
      answer:
        'Öffne deine Gruppe, tippe auf den Einladen-Button (meist oben auf dem Gruppenbildschirm) und teile den Einladungscode über eine beliebige Messaging-App mit deinen Freunden. Jeder mit dem Code kann deiner Gruppe beitreten.',
    },
    {
      question: 'Wie erstelle ich ein Ereignis?',
      answer:
        'Tippe in einer Gruppe auf den „+"-Button, um ein neues Ereignis zu erstellen. Du kannst Titel, Beschreibung, Start- und Endzeit, Ort, Kategorie und Erinnerungen festlegen und es sogar täglich, wöchentlich oder monatlich wiederholen lassen.',
    },
    {
      question: 'Wie funktionieren Erinnerungen?',
      answer:
        'Beim Erstellen oder Bearbeiten eines Ereignisses kannst du eine oder mehrere Erinnerungszeiten hinzufügen (z. B. 10 Minuten vorher, 1 Stunde vorher). Die App sendet dir zu jeder Erinnerungszeit eine Push-Mitteilung, damit du kein Ereignis verpasst.',
    },
    {
      question: 'Was sind wiederkehrende Ereignisse?',
      answer:
        'Du kannst Ereignisse täglich, wöchentlich oder monatlich wiederholen lassen. Optional legst du ein Enddatum fest, damit die Wiederholung nach einem bestimmten Datum endet. Die Wiederholungen erscheinen automatisch im Gruppenkalender.',
    },
    {
      question: 'Wie ändere ich mein Passwort oder meine E-Mail?',
      answer:
        'Gehe zu deinem Profil (das Personen-Symbol oben rechts auf dem Startbildschirm). Scrolle nach unten zu den Abschnitten „Passwort ändern" und „E-Mail ändern". Zur Bestätigung musst du dein aktuelles Passwort eingeben.',
    },
    {
      question: 'Was bedeuten die Rollen Admin und Zuschauer?',
      answer:
        'Admins können Ereignisse erstellen, Gruppeneinstellungen bearbeiten, Mitglieder einladen, Mitglieder befördern/zurückstufen und die Gruppe löschen. Zuschauer können Ereignisse und Mitglieder sehen, aber nichts ändern. Nur der ursprüngliche Gruppenersteller kann andere Admins zurückstufen.',
    },
    {
      question: 'Wie verlasse ich eine Gruppe?',
      answer:
        'Öffne die Gruppe und suche nach der Einstellungs- oder Verlassen-Option. Hinweis: Als Gruppen-Admin kannst du nicht verlassen — du musst zuerst die Gruppe löschen oder die Admin-Rechte übertragen.',
    },
    {
      question: 'Wie lösche ich eine Gruppe?',
      answer:
        'Nur der Gruppen-Admin kann eine Gruppe löschen. Öffne die Gruppe, gehe zu den Einstellungen und wähle „Gruppe löschen". Dadurch werden die Gruppe und alle ihre Ereignisse dauerhaft entfernt — dies kann nicht rückgängig gemacht werden.',
    },
    {
      question: 'Was passiert, wenn ich mich abmelde?',
      answer:
        'Nach dem Abmelden gelangst du zurück zum Anmeldebildschirm. Wenn du beim Anmelden „Angemeldet bleiben" aktiviert hattest, bleibst du auch nach dem Schließen der App angemeldet. Andernfalls musst du dich erneut anmelden.',
    },
  ],
};

const pt: HelpContent = {
  title: 'Ajuda e suporte',
  subtitle: 'Encontre respostas para perguntas comuns ou fale conosco diretamente',
  faqTitle: 'Perguntas frequentes',
  contactTitle: 'Ainda precisa de ajuda?',
  contactDescription: 'Envie-nos um e-mail e responderemos o mais rápido possível. Estamos aqui para ajudar!',
  faqs: [
    {
      question: 'O que é o Feeble?',
      answer:
        'O Feeble é um app de gestão de eventos em grupo. Você pode criar ou entrar em grupos, organizar eventos com os membros do seu grupo, definir lembretes e gerenciar eventos recorrentes — tudo em um só lugar.',
    },
    {
      question: 'Como crio um grupo?',
      answer:
        'Toque no botão azul "+" na tela inicial e selecione "Criar grupo". Dê um nome ao seu grupo e uma descrição opcional. Você se tornará automaticamente o admin do grupo e um código de convite único será gerado para outros entrarem.',
    },
    {
      question: 'Como entro em um grupo?',
      answer:
        'Toque no ícone de pessoa com sinal de mais na tela inicial e digite o código de convite compartilhado pelo admin do grupo. Se o código for válido, você será adicionado ao grupo instantaneamente.',
    },
    {
      question: 'Como convido outras pessoas para o meu grupo?',
      answer:
        'Abra seu grupo, toque no botão de convite (geralmente no topo da tela do grupo) e compartilhe o código de convite com seus amigos por qualquer app de mensagens. Qualquer pessoa com o código pode entrar no seu grupo.',
    },
    {
      question: 'Como crio um evento?',
      answer:
        'Dentro de um grupo, toque no botão "+" para criar um novo evento. Você pode definir título, descrição, horário de início e fim, local, categoria, lembretes e até fazê-lo repetir diária, semanal ou mensalmente.',
    },
    {
      question: 'Como funcionam os lembretes?',
      answer:
        'Ao criar ou editar um evento, você pode adicionar um ou mais horários de lembrete (ex. 10 minutos antes, 1 hora antes). O app enviará uma notificação push em cada horário de lembrete para você nunca perder um evento.',
    },
    {
      question: 'O que são eventos recorrentes?',
      answer:
        'Você pode configurar eventos para repetir diária, semanal ou mensalmente. Opcionalmente, defina uma data de término para o evento parar de repetir. As ocorrências recorrentes aparecem automaticamente no calendário do grupo.',
    },
    {
      question: 'Como altero minha senha ou e-mail?',
      answer:
        'Vá ao seu Perfil (o ícone de pessoa no canto superior direito da tela inicial). Role para baixo até as seções "Alterar senha" e "Alterar e-mail". Você precisará digitar sua senha atual para confirmar a mudança.',
    },
    {
      question: 'O que significam as funções admin e espectador?',
      answer:
        'Admins podem criar eventos, editar as configurações do grupo, convidar membros, promover/rebaixar membros e excluir o grupo. Espectadores podem ver eventos e membros, mas não fazer mudanças. Somente o criador original do grupo pode rebaixar outros admins.',
    },
    {
      question: 'Como saio de um grupo?',
      answer:
        'Abra o grupo e procure a opção de configurações ou sair. Nota: se você é o admin do grupo, não pode sair — precisará primeiro excluir o grupo ou transferir os direitos de admin.',
    },
    {
      question: 'Como excluo um grupo?',
      answer:
        'Somente o admin do grupo pode excluir um grupo. Abra o grupo, vá em configurações e selecione "Excluir grupo". Isso removerá o grupo e todos os seus eventos permanentemente — esta ação não pode ser desfeita.',
    },
    {
      question: 'O que acontece quando saio da conta?',
      answer:
        'Ao sair, você voltará à tela de login. Se marcou "Lembrar de mim" ao entrar, permanecerá conectado mesmo após fechar o app. Caso contrário, será necessário entrar novamente.',
    },
  ],
};

const zh: HelpContent = {
  title: '帮助与支持',
  subtitle: '查找常见问题的答案，或直接联系我们',
  faqTitle: '常见问题',
  contactTitle: '仍需帮助？',
  contactDescription: '给我们发送电子邮件，我们会尽快回复您。我们随时为您服务！',
  faqs: [
    {
      question: 'Feeble 是什么？',
      answer:
        'Feeble 是一款群组活动管理应用。您可以创建或加入群组、与群组成员一起组织活动、设置提醒并管理重复活动——一切尽在一处。',
    },
    {
      question: '如何创建群组？',
      answer:
        '点击主屏幕上的蓝色"+"按钮，选择"创建群组"。为您的群组命名并添加可选描述。您将自动成为群组管理员，并生成一个唯一的邀请码供他人加入。',
    },
    {
      question: '如何加入群组？',
      answer:
        '点击主屏幕上的"人物加号"图标，然后输入群组管理员分享的邀请码。如果邀请码有效，您将立即被添加到群组。',
    },
    {
      question: '如何邀请他人加入我的群组？',
      answer:
        '打开您的群组，点击邀请按钮（通常在群组页面顶部），并通过任何消息应用与朋友分享邀请码。任何拥有邀请码的人都可以加入您的群组。',
    },
    {
      question: '如何创建活动？',
      answer:
        '在群组内，点击"+"按钮创建新活动。您可以设置标题、描述、开始和结束时间、地点、类别、提醒，甚至可以让它每天、每周或每月重复。',
    },
    {
      question: '提醒是如何工作的？',
      answer:
        '创建或编辑活动时，您可以添加一个或多个提醒时间（例如提前10分钟、提前1小时）。应用会在每个提醒时间向您发送推送通知，让您绝不错过任何活动。',
    },
    {
      question: '什么是重复活动？',
      answer:
        '您可以将活动设置为每天、每周或每月重复。可以选择设置结束日期，让活动在特定日期后停止重复。重复的活动会自动显示在您的群组日历中。',
    },
    {
      question: '如何修改密码或邮箱？',
      answer:
        '前往您的个人资料（主屏幕右上角的人物图标）。向下滚动找到"修改密码"和"修改邮箱"部分。您需要输入当前密码来确认更改。',
    },
    {
      question: '管理员和查看者角色是什么意思？',
      answer:
        '管理员可以创建活动、编辑群组设置、邀请成员、提升/降级成员以及删除群组。查看者可以看到活动和成员，但无法进行更改。只有群组的原始创建者可以降级其他管理员。',
    },
    {
      question: '如何退出群组？',
      answer:
        '打开群组并查找设置或退出选项。注意：如果您是群组管理员，则无法退出——您需要先删除群组或转移管理员权限。',
    },
    {
      question: '如何删除群组？',
      answer:
        '只有群组管理员可以删除群组。打开群组，进入设置，选择"删除群组"。这将永久删除该群组及其所有活动——此操作无法撤销。',
    },
    {
      question: '退出登录后会怎样？',
      answer:
        '退出登录后，您将返回登录界面。如果登录时勾选了"记住我"，即使关闭应用您也会保持登录状态。如果未勾选，退出或关闭应用后需要重新登录。',
    },
  ],
};

const hi: HelpContent = {
  title: 'सहायता और समर्थन',
  subtitle: 'सामान्य प्रश्नों के उत्तर पाएँ या सीधे हमसे संपर्क करें',
  faqTitle: 'अक्सर पूछे जाने वाले प्रश्न',
  contactTitle: 'अभी भी सहायता चाहिए?',
  contactDescription: 'हमें ईमेल भेजें और हम जल्द से जल्द आपको जवाब देंगे। हम मदद के लिए यहाँ हैं!',
  faqs: [
    {
      question: 'Feeble क्या है?',
      answer:
        'Feeble एक समूह कार्यक्रम प्रबंधन ऐप है। आप समूह बना सकते हैं या उनसे जुड़ सकते हैं, अपने समूह के सदस्यों के साथ कार्यक्रम आयोजित कर सकते हैं, अनुस्मारक सेट कर सकते हैं और दोहराए जाने वाले कार्यक्रम प्रबंधित कर सकते हैं — सब कुछ एक ही जगह।',
    },
    {
      question: 'मैं समूह कैसे बनाऊँ?',
      answer:
        'होम स्क्रीन पर नीले "+" बटन पर टैप करें और "समूह बनाएँ" चुनें। अपने समूह को नाम दें और चाहें तो विवरण जोड़ें। आप स्वतः ही समूह के एडमिन बन जाएँगे और दूसरों के जुड़ने के लिए एक अनोखा आमंत्रण कोड बनेगा।',
    },
    {
      question: 'मैं समूह से कैसे जुड़ूँ?',
      answer:
        'होम स्क्रीन पर व्यक्ति-और-प्लस आइकन पर टैप करें, फिर समूह एडमिन द्वारा साझा किया गया आमंत्रण कोड दर्ज करें। यदि कोड सही है, तो आप तुरंत समूह में जोड़ दिए जाएँगे।',
    },
    {
      question: 'मैं दूसरों को अपने समूह में कैसे आमंत्रित करूँ?',
      answer:
        'अपना समूह खोलें, आमंत्रण बटन पर टैप करें (आमतौर पर समूह स्क्रीन के शीर्ष पर), और किसी भी मैसेजिंग ऐप से अपने दोस्तों के साथ आमंत्रण कोड साझा करें। कोड रखने वाला कोई भी व्यक्ति आपके समूह से जुड़ सकता है।',
    },
    {
      question: 'मैं कार्यक्रम कैसे बनाऊँ?',
      answer:
        'समूह के अंदर, नया कार्यक्रम बनाने के लिए "+" बटन पर टैप करें। आप शीर्षक, विवरण, प्रारंभ और समाप्ति समय, स्थान, श्रेणी, अनुस्मारक सेट कर सकते हैं और इसे दैनिक, साप्ताहिक या मासिक रूप से दोहरा भी सकते हैं।',
    },
    {
      question: 'अनुस्मारक कैसे काम करते हैं?',
      answer:
        'कार्यक्रम बनाते या संपादित करते समय, आप एक या अधिक अनुस्मारक समय जोड़ सकते हैं (जैसे 10 मिनट पहले, 1 घंटा पहले)। ऐप हर अनुस्मारक समय पर आपको पुश सूचना भेजेगा ताकि आप कभी कोई कार्यक्रम न चूकें।',
    },
    {
      question: 'दोहराए जाने वाले कार्यक्रम क्या हैं?',
      answer:
        'आप कार्यक्रमों को दैनिक, साप्ताहिक या मासिक रूप से दोहराने के लिए सेट कर सकते हैं। चाहें तो समाप्ति तिथि सेट करें ताकि कार्यक्रम एक निश्चित तिथि के बाद दोहराना बंद कर दे। दोहराए जाने वाले कार्यक्रम आपके समूह कैलेंडर में स्वतः दिखाई देते हैं।',
    },
    {
      question: 'मैं अपना पासवर्ड या ईमेल कैसे बदलूँ?',
      answer:
        'अपनी प्रोफ़ाइल पर जाएँ (होम स्क्रीन के ऊपर-दाएँ कोने में व्यक्ति आइकन)। नीचे स्क्रॉल करके "पासवर्ड बदलें" और "ईमेल बदलें" अनुभाग खोजें। बदलाव की पुष्टि के लिए आपको अपना वर्तमान पासवर्ड दर्ज करना होगा।',
    },
    {
      question: 'एडमिन और दर्शक भूमिकाओं का क्या मतलब है?',
      answer:
        'एडमिन कार्यक्रम बना सकते हैं, समूह सेटिंग्स संपादित कर सकते हैं, सदस्यों को आमंत्रित कर सकते हैं, सदस्यों को पदोन्नत/पदावनत कर सकते हैं और समूह हटा सकते हैं। दर्शक कार्यक्रम और सदस्य देख सकते हैं लेकिन बदलाव नहीं कर सकते। केवल समूह का मूल निर्माता ही अन्य एडमिन को पदावनत कर सकता है।',
    },
    {
      question: 'मैं समूह कैसे छोड़ूँ?',
      answer:
        'समूह खोलें और सेटिंग्स या छोड़ने का विकल्प खोजें। ध्यान दें: यदि आप समूह के एडमिन हैं, तो आप छोड़ नहीं सकते — आपको पहले समूह हटाना होगा या एडमिन अधिकार स्थानांतरित करने होंगे।',
    },
    {
      question: 'मैं समूह कैसे हटाऊँ?',
      answer:
        'केवल समूह का एडमिन ही समूह हटा सकता है। समूह खोलें, सेटिंग्स में जाएँ और "समूह हटाएँ" चुनें। इससे समूह और उसके सभी कार्यक्रम स्थायी रूप से हट जाएँगे — यह क्रिया पूर्ववत नहीं की जा सकती।',
    },
    {
      question: 'साइन आउट करने पर क्या होता है?',
      answer:
        'साइन आउट करने पर आप साइन-इन स्क्रीन पर वापस आ जाएँगे। यदि साइन इन करते समय "मुझे याद रखें" चुना था, तो ऐप बंद करने के बाद भी आप साइन इन रहेंगे। अन्यथा, आपको फिर से साइन इन करना होगा।',
    },
  ],
};

export const HELP_CONTENT: Record<LanguageCode, HelpContent> = {
  en,
  am,
  es,
  fr,
  de,
  pt,
  zh,
  hi,
};
