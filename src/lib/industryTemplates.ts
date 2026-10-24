/**
 * The industry template pack: an intro email for every industry the CRM's leads are in, for every country we
 * prospect, written in the language customers there read. Each template is tagged with its countries and
 * industry, so the lead email form suggests the right one with one click.
 */
import type { TemplateLanguage } from "./templates";

export const PACK_INDUSTRIES = [
  "Restaurant", "Hospitality", "Spa", "Wellness", "Gym", "Clinic", "Trades", "Professional-Services", "Export-Trading", "Retail",
] as const;
type Industry = (typeof PACK_INDUSTRIES)[number];

/** Who each version is for. US/Canada and the UK-style English group differ in spelling. */
export const PACK_REGIONS = [
  { key: "us", label: "US & Canada", language: "en", countries: ["United States", "Canada"] },
  {
    key: "uk", label: "UK, Ireland, Australia, NZ & Northern Europe", language: "en",
    countries: ["United Kingdom", "Ireland", "Australia", "New Zealand", "Netherlands", "Denmark", "Sweden", "Norway", "Finland", "Belgium"],
  },
  { key: "de", label: "Deutsch", language: "de", countries: ["Germany", "Austria", "Switzerland"] },
  { key: "th", label: "ภาษาไทย", language: "th", countries: ["Thailand"] },
  { key: "es", label: "Español", language: "es", countries: ["Spain"] },
  { key: "it", label: "Italiano", language: "it", countries: ["Italy"] },
  { key: "fr", label: "Français", language: "fr", countries: ["France"] },
] as const satisfies readonly { key: string; label: string; language: TemplateLanguage; countries: readonly string[] }[];
type Lang = "en" | "de" | "th" | "es" | "it" | "fr";

/** Per industry and language: subject, why a website matters, three things we'd build, and how to say "businesses like yours". */
type Pitch = { subject: string; hook: string; points: [string, string, string]; who: string };

const PITCHES: Record<Industry, Record<Lang, Pitch>> = {
  Restaurant: {
    en: {
      subject: "More bookings for {{company}}",
      hook: "Most diners look at a restaurant's website and Google Maps listing before they book, so a clear, fast site makes a real difference.",
      points: ["your menu, photos and opening hours, easy to read on a phone", "online table reservations or a simple booking form", "showing up properly on Google and Google Maps when people search nearby"],
      who: "restaurants",
    },
    de: {
      subject: "Mehr Reservierungen für {{company}}",
      hook: "Die meisten Gäste schauen sich vor einer Reservierung die Website und den Google-Maps-Eintrag eines Restaurants an – eine klare, schnelle Website macht da einen echten Unterschied.",
      points: ["Speisekarte, Fotos und Öffnungszeiten, gut lesbar auf dem Smartphone", "Online-Tischreservierung oder ein einfaches Buchungsformular", "eine gute Platzierung bei Google und Google Maps, wenn Gäste in der Nähe suchen"],
      who: "Restaurants",
    },
    th: {
      subject: "เพิ่มการจองโต๊ะให้ {{company}}",
      hook: "ลูกค้าส่วนใหญ่จะดูเว็บไซต์และหน้า Google Maps ของร้านก่อนตัดสินใจไปทาน เว็บไซต์ที่ชัดเจนและโหลดเร็วจึงช่วยได้มาก",
      points: ["เมนู รูปภาพ และเวลาเปิดปิด อ่านง่ายบนมือถือ", "ระบบจองโต๊ะออนไลน์หรือฟอร์มจองง่ายๆ", "แสดงผลบน Google และ Google Maps ได้ดีเมื่อลูกค้าค้นหาร้านใกล้ตัว"],
      who: "ร้านอาหาร",
    },
    es: {
      subject: "Más reservas para {{company}}",
      hook: "La mayoría de los clientes mira la web y la ficha de Google Maps de un restaurante antes de reservar, así que una web clara y rápida marca la diferencia.",
      points: ["la carta, las fotos y el horario, fáciles de leer en el móvil", "reservas de mesa online o un formulario sencillo", "aparecer bien en Google y Google Maps cuando buscan un restaurante cerca"],
      who: "restaurantes",
    },
    it: {
      subject: "Più prenotazioni per {{company}}",
      hook: "La maggior parte dei clienti guarda il sito e la scheda Google Maps di un ristorante prima di prenotare: un sito chiaro e veloce fa davvero la differenza.",
      points: ["menù, foto e orari, facili da leggere sullo smartphone", "prenotazione del tavolo online o un semplice modulo", "una buona visibilità su Google e Google Maps quando cercano un ristorante in zona"],
      who: "ristoranti",
    },
    fr: {
      subject: "Plus de réservations pour {{company}}",
      hook: "La plupart des clients consultent le site et la fiche Google Maps d’un restaurant avant de réserver : un site clair et rapide fait vraiment la différence.",
      points: ["votre carte, vos photos et vos horaires, lisibles sur mobile", "la réservation de table en ligne ou un formulaire simple", "une bonne visibilité sur Google et Google Maps quand on cherche un restaurant à proximité"],
      who: "restaurants",
    },
  },
  Hospitality: {
    en: {
      subject: "Direct bookings for {{company}}",
      hook: "A good website lets guests book with you directly, instead of you paying commission to booking platforms on every stay.",
      points: ["a gallery of your rooms and facilities that looks great on phones", "a direct booking or inquiry form, so more bookings come in commission-free", "a strong Google listing and pages international guests can read easily"],
      who: "hotels and guesthouses",
    },
    de: {
      subject: "Mehr Direktbuchungen für {{company}}",
      hook: "Mit einer guten Website buchen Gäste direkt bei Ihnen – statt dass Sie für jede Übernachtung Provision an Buchungsportale zahlen.",
      points: ["eine Galerie Ihrer Zimmer und Ausstattung, die auf dem Smartphone überzeugt", "ein Direktbuchungs- oder Anfrageformular, damit mehr Buchungen provisionsfrei hereinkommen", "einen starken Google-Eintrag und Seiten, die auch internationale Gäste gut verstehen"],
      who: "Hotels und Pensionen",
    },
    th: {
      subject: "เพิ่มการจองตรงให้ {{company}}",
      hook: "เว็บไซต์ที่ดีช่วยให้แขกจองกับคุณได้โดยตรง ไม่ต้องเสียค่าคอมมิชชั่นให้แพลตฟอร์มจองทุกครั้ง",
      points: ["แกลเลอรีห้องพักและสิ่งอำนวยความสะดวกที่ดูดีบนมือถือ", "ระบบจองตรงหรือฟอร์มสอบถาม เพื่อให้ได้การจองแบบไม่เสียค่าคอมมิชชั่นมากขึ้น", "หน้า Google ที่แข็งแรง และเนื้อหาภาษาอังกฤษสำหรับแขกต่างชาติ"],
      who: "โรงแรมและเกสต์เฮาส์",
    },
    es: {
      subject: "Reservas directas para {{company}}",
      hook: "Una buena web permite que los huéspedes reserven directamente con usted, en lugar de pagar comisión a las plataformas en cada estancia.",
      points: ["una galería de habitaciones e instalaciones que luzca bien en el móvil", "un formulario de reserva directa o de consulta, para que más reservas lleguen sin comisión", "una buena ficha en Google y páginas que los huéspedes extranjeros entiendan fácilmente"],
      who: "hoteles y alojamientos",
    },
    it: {
      subject: "Prenotazioni dirette per {{company}}",
      hook: "Un buon sito permette agli ospiti di prenotare direttamente da voi, invece di pagare una commissione ai portali per ogni soggiorno.",
      points: ["una galleria di camere e servizi che si veda bene sullo smartphone", "un modulo di prenotazione diretta o di richiesta, per più prenotazioni senza commissioni", "una scheda Google solida e pagine facili da capire anche per gli ospiti stranieri"],
      who: "hotel e strutture ricettive",
    },
    fr: {
      subject: "Plus de réservations directes pour {{company}}",
      hook: "Un bon site permet à vos clients de réserver directement chez vous, plutôt que de payer une commission aux plateformes à chaque séjour.",
      points: ["une galerie de vos chambres et équipements, superbe sur mobile", "un formulaire de réservation directe ou de demande, pour plus de réservations sans commission", "une fiche Google solide et des pages faciles à lire pour les clients étrangers"],
      who: "hôtels et chambres d’hôtes",
    },
  },
  Spa: {
    en: {
      subject: "More treatment bookings for {{company}}",
      hook: "Clients want to see your treatments and prices, then book in a few taps, often late in the evening when you're closed.",
      points: ["a treatment menu with prices and photos", "online booking that works around the clock", "gift vouchers and a strong Google Maps listing"],
      who: "spas",
    },
    de: {
      subject: "Mehr Buchungen für {{company}}",
      hook: "Kundinnen und Kunden möchten Ihre Behandlungen und Preise sehen und mit wenigen Klicks buchen – oft abends, wenn Sie geschlossen haben.",
      points: ["eine Behandlungsübersicht mit Preisen und Fotos", "Online-Buchung rund um die Uhr", "Gutscheine und einen starken Google-Maps-Eintrag"],
      who: "Spas und Kosmetikstudios",
    },
    th: {
      subject: "เพิ่มการจองทรีตเมนต์ให้ {{company}}",
      hook: "ลูกค้าอยากเห็นทรีตเมนต์และราคา แล้วจองได้ในไม่กี่คลิก บ่อยครั้งเป็นช่วงดึกที่ร้านปิดแล้ว",
      points: ["เมนูทรีตเมนต์พร้อมราคาและรูปภาพ", "ระบบจองออนไลน์ตลอด 24 ชั่วโมง", "บัตรกำนัล และหน้า Google Maps ที่แข็งแรง"],
      who: "สปา",
    },
    es: {
      subject: "Más reservas de tratamientos para {{company}}",
      hook: "Los clientes quieren ver sus tratamientos y precios y reservar en pocos clics, a menudo por la noche, cuando ya está cerrado.",
      points: ["una carta de tratamientos con precios y fotos", "reservas online las 24 horas", "tarjetas regalo y una buena ficha en Google Maps"],
      who: "spas y centros de belleza",
    },
    it: {
      subject: "Più prenotazioni di trattamenti per {{company}}",
      hook: "I clienti vogliono vedere trattamenti e prezzi e prenotare in pochi clic, spesso la sera, quando siete chiusi.",
      points: ["un listino trattamenti con prezzi e foto", "prenotazione online 24 ore su 24", "buoni regalo e una scheda Google Maps solida"],
      who: "spa e centri estetici",
    },
    fr: {
      subject: "Plus de réservations de soins pour {{company}}",
      hook: "Vos clients veulent voir vos soins et vos tarifs, puis réserver en quelques clics, souvent le soir quand vous êtes fermé.",
      points: ["une carte des soins avec tarifs et photos", "la réservation en ligne 24 h/24", "des bons cadeaux et une fiche Google Maps solide"],
      who: "spas et instituts",
    },
  },
  Wellness: {
    en: {
      subject: "More clients for {{company}}",
      hook: "People looking for wellness services want to understand what you offer and book without having to phone.",
      points: ["clear pages for your sessions, classes or therapies", "online booking and easy ways to get in touch", "reviews and a strong Google listing that build trust"],
      who: "wellness businesses",
    },
    de: {
      subject: "Mehr Kundschaft für {{company}}",
      hook: "Wer Wellness- oder Gesundheitsangebote sucht, möchte schnell verstehen, was Sie anbieten, und ohne Anruf buchen.",
      points: ["klare Seiten für Ihre Kurse, Sitzungen oder Anwendungen", "Online-Buchung und einfache Kontaktmöglichkeiten", "Bewertungen und einen starken Google-Eintrag, die Vertrauen schaffen"],
      who: "Wellness-Anbieter",
    },
    th: {
      subject: "เพิ่มลูกค้าให้ {{company}}",
      hook: "คนที่มองหาบริการด้านสุขภาพอยากเข้าใจว่าคุณมีบริการอะไร และจองได้โดยไม่ต้องโทร",
      points: ["หน้าเว็บที่อธิบายคลาส เซสชัน หรือการบำบัดได้ชัดเจน", "ระบบจองออนไลน์และช่องทางติดต่อที่ง่าย", "รีวิวและหน้า Google ที่สร้างความน่าเชื่อถือ"],
      who: "ธุรกิจด้านสุขภาพ",
    },
    es: {
      subject: "Más clientes para {{company}}",
      hook: "Quien busca servicios de bienestar quiere entender lo que ofrece y reservar sin tener que llamar.",
      points: ["páginas claras para sus sesiones, clases o terapias", "reservas online y formas sencillas de contacto", "reseñas y una buena ficha en Google que generen confianza"],
      who: "centros de bienestar",
    },
    it: {
      subject: "Più clienti per {{company}}",
      hook: "Chi cerca servizi di benessere vuole capire subito cosa offrite e prenotare senza dover telefonare.",
      points: ["pagine chiare per sessioni, corsi o trattamenti", "prenotazione online e contatti semplici", "recensioni e una scheda Google solida che creano fiducia"],
      who: "centri benessere",
    },
    fr: {
      subject: "Plus de clients pour {{company}}",
      hook: "Les personnes qui cherchent des services de bien-être veulent comprendre votre offre et réserver sans avoir à appeler.",
      points: ["des pages claires pour vos séances, cours ou soins", "la réservation en ligne et des moyens de contact simples", "des avis et une fiche Google solide qui inspirent confiance"],
      who: "centres de bien-être",
    },
  },
  Gym: {
    en: {
      subject: "More members for {{company}}",
      hook: "Most people compare gyms online before they visit, so your website often decides whether they come in for a trial.",
      points: ["your class timetable, prices and facilities on one clear page", "online trial sign-ups and membership inquiries", "showing up well on Google when people search for a gym nearby"],
      who: "gyms and fitness studios",
    },
    de: {
      subject: "Mehr Mitglieder für {{company}}",
      hook: "Die meisten Menschen vergleichen Fitnessstudios online, bevor sie vorbeikommen – Ihre Website entscheidet oft, ob sie zum Probetraining kommen.",
      points: ["Kursplan, Preise und Ausstattung übersichtlich auf einer Seite", "Online-Anmeldung zum Probetraining und Mitgliedschaftsanfragen", "eine gute Platzierung bei Google, wenn jemand ein Studio in der Nähe sucht"],
      who: "Fitnessstudios",
    },
    th: {
      subject: "เพิ่มสมาชิกให้ {{company}}",
      hook: "คนส่วนใหญ่เปรียบเทียบยิมทางออนไลน์ก่อนไป เว็บไซต์ของคุณจึงมักเป็นตัวตัดสินว่าเขาจะมาลองเล่นหรือไม่",
      points: ["ตารางคลาส ราคา และสิ่งอำนวยความสะดวกในหน้าเดียวที่ชัดเจน", "สมัครทดลองเล่นและสอบถามสมาชิกออนไลน์", "แสดงผลบน Google ได้ดีเมื่อคนค้นหายิมใกล้ตัว"],
      who: "ยิมและฟิตเนส",
    },
    es: {
      subject: "Más socios para {{company}}",
      hook: "La mayoría compara gimnasios por internet antes de ir, así que su web suele decidir si vienen a una clase de prueba.",
      points: ["horario de clases, precios e instalaciones en una página clara", "inscripción online a la prueba y consultas de cuotas", "aparecer bien en Google cuando buscan un gimnasio cerca"],
      who: "gimnasios y centros de fitness",
    },
    it: {
      subject: "Più iscritti per {{company}}",
      hook: "La maggior parte delle persone confronta le palestre online prima di andarci: spesso è il sito a decidere se verranno per una prova.",
      points: ["orari dei corsi, prezzi e servizi in una pagina chiara", "iscrizione online alla prova e richieste di abbonamento", "una buona visibilità su Google quando cercano una palestra in zona"],
      who: "palestre e centri fitness",
    },
    fr: {
      subject: "Plus d’adhérents pour {{company}}",
      hook: "La plupart des gens comparent les salles en ligne avant de venir : votre site décide souvent s’ils viendront pour une séance d’essai.",
      points: ["votre planning de cours, vos tarifs et vos équipements sur une page claire", "l’inscription en ligne à l’essai et les demandes d’abonnement", "une bonne visibilité sur Google quand on cherche une salle à proximité"],
      who: "salles de sport",
    },
  },
  Clinic: {
    en: {
      subject: "Online appointments for {{company}}",
      hook: "Patients increasingly choose a clinic online, and they look for two things: trust, and an easy way to book.",
      points: ["clear pages for your treatments and your team", "online appointment requests that go straight to your inbox", "reviews and a Google listing that build confidence before the first visit"],
      who: "clinics",
    },
    de: {
      subject: "Online-Terminanfragen für {{company}}",
      hook: "Patientinnen und Patienten wählen eine Praxis immer öfter online aus – und achten auf zwei Dinge: Vertrauen und eine einfache Terminvereinbarung.",
      points: ["klare Seiten zu Ihren Behandlungen und Ihrem Team", "Online-Terminanfragen, die direkt in Ihrem Postfach landen", "Bewertungen und einen Google-Eintrag, die schon vor dem ersten Besuch Vertrauen schaffen"],
      who: "Praxen und Kliniken",
    },
    th: {
      subject: "รับนัดหมายออนไลน์ให้ {{company}}",
      hook: "ผู้ป่วยเลือกคลินิกผ่านออนไลน์มากขึ้นเรื่อยๆ และมองหาสองอย่าง คือความน่าเชื่อถือ และการนัดหมายที่ง่าย",
      points: ["หน้าเว็บอธิบายการรักษาและทีมแพทย์อย่างชัดเจน", "ฟอร์มนัดหมายออนไลน์ที่ส่งตรงถึงอีเมลของคุณ", "รีวิวและหน้า Google ที่สร้างความมั่นใจก่อนมาครั้งแรก"],
      who: "คลินิก",
    },
    es: {
      subject: "Citas online para {{company}}",
      hook: "Cada vez más pacientes eligen su clínica por internet, y buscan dos cosas: confianza y una forma fácil de pedir cita.",
      points: ["páginas claras sobre sus tratamientos y su equipo", "solicitudes de cita online que llegan directamente a su correo", "reseñas y una ficha en Google que dan confianza antes de la primera visita"],
      who: "clínicas",
    },
    it: {
      subject: "Appuntamenti online per {{company}}",
      hook: "Sempre più pazienti scelgono uno studio online e cercano due cose: fiducia e un modo semplice per prenotare.",
      points: ["pagine chiare su trattamenti e staff", "richieste di appuntamento online che arrivano direttamente nella vostra casella", "recensioni e una scheda Google che danno fiducia già prima della prima visita"],
      who: "studi medici e cliniche",
    },
    fr: {
      subject: "Prise de rendez-vous en ligne pour {{company}}",
      hook: "De plus en plus de patients choisissent leur cabinet en ligne, et ils cherchent deux choses : la confiance et une prise de rendez-vous simple.",
      points: ["des pages claires sur vos soins et votre équipe", "des demandes de rendez-vous en ligne qui arrivent directement dans votre boîte mail", "des avis et une fiche Google qui rassurent avant la première visite"],
      who: "cabinets et cliniques",
    },
  },
  Trades: {
    en: {
      subject: "More job inquiries for {{company}}",
      hook: "When someone needs a tradesperson, they search on their phone and call the first business that looks reliable.",
      points: ["a clear list of your services and the areas you cover", "a quote request form and one-tap calling", "photos of past work, reviews and a strong Google Maps listing"],
      who: "trade businesses",
    },
    de: {
      subject: "Mehr Auftragsanfragen für {{company}}",
      hook: "Wer einen Handwerker braucht, sucht auf dem Smartphone und ruft den ersten Betrieb an, der zuverlässig wirkt.",
      points: ["eine klare Übersicht Ihrer Leistungen und Ihres Einsatzgebiets", "ein Angebotsformular und Anruf mit einem Fingertipp", "Fotos von Referenzprojekten, Bewertungen und einen starken Google-Maps-Eintrag"],
      who: "Handwerksbetriebe",
    },
    th: {
      subject: "เพิ่มงานให้ {{company}}",
      hook: "เวลาคนต้องการช่าง เขาจะค้นหาบนมือถือ แล้วโทรหาร้านแรกที่ดูน่าเชื่อถือ",
      points: ["รายการบริการและพื้นที่ที่ให้บริการอย่างชัดเจน", "ฟอร์มขอใบเสนอราคา และปุ่มโทรได้ทันที", "รูปผลงาน รีวิว และหน้า Google Maps ที่แข็งแรง"],
      who: "ธุรกิจช่างและรับเหมา",
    },
    es: {
      subject: "Más solicitudes de trabajo para {{company}}",
      hook: "Cuando alguien necesita un profesional, busca en el móvil y llama a la primera empresa que parece de confianza.",
      points: ["una lista clara de sus servicios y de las zonas que cubre", "un formulario de presupuesto y llamada con un solo toque", "fotos de trabajos anteriores, reseñas y una buena ficha en Google Maps"],
      who: "empresas de reformas y oficios",
    },
    it: {
      subject: "Più richieste di lavoro per {{company}}",
      hook: "Quando serve un artigiano, si cerca sullo smartphone e si chiama la prima azienda che sembra affidabile.",
      points: ["un elenco chiaro dei vostri servizi e delle zone coperte", "un modulo per i preventivi e la chiamata con un tocco", "foto dei lavori svolti, recensioni e una scheda Google Maps solida"],
      who: "artigiani e imprese",
    },
    fr: {
      subject: "Plus de demandes de devis pour {{company}}",
      hook: "Quand on a besoin d’un artisan, on cherche sur son téléphone et on appelle la première entreprise qui inspire confiance.",
      points: ["une liste claire de vos services et de votre zone d’intervention", "un formulaire de devis et l’appel en un clic", "des photos de vos réalisations, des avis et une fiche Google Maps solide"],
      who: "artisans",
    },
  },
  "Professional-Services": {
    en: {
      subject: "A website that wins clients for {{company}}",
      hook: "Clients often judge a firm by its website before they ever get in touch.",
      points: ["a professional site that explains your services clearly", "team profiles and client results that build credibility", "an easy way to book a consultation or send an inquiry"],
      who: "professional firms",
    },
    de: {
      subject: "Eine Website, die Mandanten gewinnt – für {{company}}",
      hook: "Viele Kunden beurteilen eine Kanzlei oder Agentur anhand ihrer Website, noch bevor sie Kontakt aufnehmen.",
      points: ["eine professionelle Website, die Ihre Leistungen klar erklärt", "Teamprofile und Referenzen, die Glaubwürdigkeit schaffen", "eine einfache Möglichkeit, ein Erstgespräch zu buchen oder eine Anfrage zu senden"],
      who: "Kanzleien und Dienstleister",
    },
    th: {
      subject: "เว็บไซต์ที่ช่วยหาลูกค้าให้ {{company}}",
      hook: "ลูกค้ามักตัดสินบริษัทจากเว็บไซต์ ก่อนที่จะติดต่อเข้ามาเสียอีก",
      points: ["เว็บไซต์มืออาชีพที่อธิบายบริการได้ชัดเจน", "โปรไฟล์ทีมงานและผลงาน ที่สร้างความน่าเชื่อถือ", "ช่องทางนัดปรึกษาหรือส่งคำถามได้ง่าย"],
      who: "บริษัทที่ให้บริการวิชาชีพ",
    },
    es: {
      subject: "Una web que consiga clientes para {{company}}",
      hook: "Muchos clientes juzgan a un despacho o consultora por su web antes de ponerse en contacto.",
      points: ["una web profesional que explique sus servicios con claridad", "perfiles del equipo y casos de éxito que generen credibilidad", "una forma sencilla de reservar una consulta o enviar una pregunta"],
      who: "despachos y consultoras",
    },
    it: {
      subject: "Un sito che porta clienti a {{company}}",
      hook: "Molti clienti giudicano uno studio dal suo sito, prima ancora di contattarlo.",
      points: ["un sito professionale che spieghi chiaramente i vostri servizi", "profili del team e risultati per i clienti che creano credibilità", "un modo semplice per prenotare una consulenza o inviare una richiesta"],
      who: "studi professionali",
    },
    fr: {
      subject: "Un site qui fait venir des clients chez {{company}}",
      hook: "Beaucoup de clients jugent un cabinet sur son site, avant même de le contacter.",
      points: ["un site professionnel qui présente clairement vos services", "des profils d’équipe et des réussites clients qui renforcent votre crédibilité", "un moyen simple de réserver une consultation ou d’envoyer une demande"],
      who: "cabinets et sociétés de conseil",
    },
  },
  "Export-Trading": {
    en: {
      subject: "More international inquiries for {{company}}",
      hook: "Overseas buyers usually find suppliers online, and a clear website helps them trust you from the first visit.",
      points: ["a product catalogue that's easy to browse", "pages written for international buyers", "a quote request form that sends inquiries straight to you"],
      who: "exporters and trading companies",
    },
    de: {
      subject: "Mehr internationale Anfragen für {{company}}",
      hook: "Einkäufer im Ausland finden Lieferanten meist online – eine klare Website schafft schon beim ersten Besuch Vertrauen.",
      points: ["einen übersichtlichen Produktkatalog", "Seiten auf Englisch für internationale Einkäufer", "ein Anfrageformular, das Anfragen direkt an Sie schickt"],
      who: "Export- und Handelsunternehmen",
    },
    th: {
      subject: "เพิ่มคำสั่งซื้อจากต่างประเทศให้ {{company}}",
      hook: "ผู้ซื้อต่างประเทศมักหาซัพพลายเออร์ทางออนไลน์ เว็บไซต์ที่ชัดเจนช่วยให้เขาเชื่อใจคุณตั้งแต่ครั้งแรก",
      points: ["แคตตาล็อกสินค้าที่ดูง่าย", "หน้าเว็บภาษาอังกฤษสำหรับผู้ซื้อต่างชาติ", "ฟอร์มขอใบเสนอราคาที่ส่งตรงถึงคุณ"],
      who: "ธุรกิจส่งออกและเทรดดิ้ง",
    },
    es: {
      subject: "Más consultas internacionales para {{company}}",
      hook: "Los compradores extranjeros suelen encontrar proveedores por internet, y una web clara les da confianza desde la primera visita.",
      points: ["un catálogo de productos fácil de consultar", "páginas en inglés para compradores internacionales", "un formulario de presupuesto que le envía las consultas directamente"],
      who: "empresas exportadoras",
    },
    it: {
      subject: "Più richieste dall’estero per {{company}}",
      hook: "I buyer stranieri trovano i fornitori soprattutto online, e un sito chiaro dà loro fiducia fin dalla prima visita.",
      points: ["un catalogo prodotti facile da consultare", "pagine in inglese per i buyer internazionali", "un modulo per i preventivi che vi invia le richieste direttamente"],
      who: "aziende esportatrici",
    },
    fr: {
      subject: "Plus de demandes internationales pour {{company}}",
      hook: "Les acheteurs étrangers trouvent généralement leurs fournisseurs en ligne, et un site clair les met en confiance dès la première visite.",
      points: ["un catalogue produits facile à parcourir", "des pages en anglais pour les acheteurs internationaux", "un formulaire de devis qui vous envoie les demandes directement"],
      who: "entreprises exportatrices",
    },
  },
  Retail: {
    en: {
      subject: "More customers for {{company}}",
      hook: "Shoppers often check a store online first, to see what it sells and when it's open.",
      points: ["your products, opening hours and location, clear on any phone", "an online shop or click-and-collect, if you'd like one", "a strong Google Maps listing so nearby shoppers find you"],
      who: "shops",
    },
    de: {
      subject: "Mehr Kundschaft für {{company}}",
      hook: "Viele Kunden schauen sich ein Geschäft zuerst online an – was es dort gibt und wann geöffnet ist.",
      points: ["Ihr Sortiment, Öffnungszeiten und Standort, klar auf jedem Smartphone", "auf Wunsch einen Onlineshop oder Click & Collect", "einen starken Google-Maps-Eintrag, damit Kunden in der Nähe Sie finden"],
      who: "Einzelhändler",
    },
    th: {
      subject: "เพิ่มลูกค้าให้ {{company}}",
      hook: "ลูกค้ามักเช็กร้านทางออนไลน์ก่อน ว่ามีสินค้าอะไรและเปิดกี่โมง",
      points: ["สินค้า เวลาเปิดปิด และที่ตั้ง ดูง่ายบนมือถือ", "ร้านค้าออนไลน์หรือสั่งแล้วมารับที่ร้าน ถ้าต้องการ", "หน้า Google Maps ที่แข็งแรง ให้ลูกค้าแถวนั้นหาเจอ"],
      who: "ร้านค้า",
    },
    es: {
      subject: "Más clientes para {{company}}",
      hook: "Muchos compradores miran una tienda por internet antes de ir, para ver qué vende y cuándo abre.",
      points: ["sus productos, horario y ubicación, claros en cualquier móvil", "una tienda online o recogida en tienda, si le interesa", "una buena ficha en Google Maps para que los clientes cercanos le encuentren"],
      who: "tiendas",
    },
    it: {
      subject: "Più clienti per {{company}}",
      hook: "Molti clienti guardano un negozio online prima di andarci, per vedere cosa vende e quando è aperto.",
      points: ["prodotti, orari e posizione, chiari su qualsiasi smartphone", "un negozio online o il ritiro in negozio, se vi interessa", "una scheda Google Maps solida, così i clienti in zona vi trovano"],
      who: "negozi",
    },
    fr: {
      subject: "Plus de clients pour {{company}}",
      hook: "Beaucoup de clients regardent une boutique en ligne avant de s’y rendre, pour voir ce qu’elle vend et quand elle est ouverte.",
      points: ["vos produits, vos horaires et votre adresse, clairs sur mobile", "une boutique en ligne ou le retrait en magasin, si vous le souhaitez", "une fiche Google Maps solide pour que les clients du quartier vous trouvent"],
      who: "boutiques",
    },
  },
};

/** The rest of each email, per language. */
const FRAMES: Record<Lang, (p: Pitch) => string> = {
  en: (p) => `Hi {{first_name|there}},

I came across {{company}} and had a look at how you show up online. ${p.hook}

We're Standard Projects, a small studio that builds fast, mobile-friendly websites. For ${p.who}, that usually means:
- ${p.points[0]}
- ${p.points[1]}
- ${p.points[2]}

Would a free 15-minute call next week be useful? I can share a few ideas specific to {{company}}, with no obligation.

Best regards,
{{agent_name}}
Standard Projects · standardprojects.org`,
  de: (p) => `Guten Tag,

ich bin auf {{company}} gestoßen und habe mir Ihren Online-Auftritt angesehen. ${p.hook}

Wir sind Standard Projects, ein kleines Studio für schnelle, mobilfreundliche Websites. Für ${p.who} bedeutet das meist:
- ${p.points[0]}
- ${p.points[1]}
- ${p.points[2]}

Hätten Sie nächste Woche Zeit für ein kostenloses, 15-minütiges Gespräch? Ich zeige Ihnen gern ein paar konkrete Ideen für {{company}} – ganz unverbindlich. Das Gespräch können wir gern auch auf Englisch führen.

Mit freundlichen Grüßen
{{agent_name}}
Standard Projects · standardprojects.org`,
  th: (p) => `สวัสดีครับ/ค่ะ คุณ{{first_name|ผู้ดูแล}}

ทาง Standard Projects ได้เห็น {{company}} และลองดูการแสดงผลบนออนไลน์ของร้านแล้วครับ/ค่ะ ${p.hook}

เราเป็นสตูดิโอเล็กๆ ที่ทำเว็บไซต์โหลดเร็วและใช้งานบนมือถือได้ดี สำหรับ${p.who} ส่วนใหญ่จะหมายถึง:
- ${p.points[0]}
- ${p.points[1]}
- ${p.points[2]}

สะดวกคุยสั้นๆ 15 นาทีในสัปดาห์หน้าไหมครับ/คะ? เรามีไอเดียสำหรับ {{company}} โดยเฉพาะ ไม่มีค่าใช้จ่ายและไม่มีข้อผูกมัด

ขอบคุณครับ/ค่ะ
{{agent_name}}
Standard Projects · standardprojects.org`,
  es: (p) => `Buenos días,

He visto {{company}} y he echado un vistazo a su presencia online. ${p.hook}

Somos Standard Projects, un pequeño estudio que crea webs rápidas y adaptadas al móvil. Para ${p.who}, eso suele significar:
- ${p.points[0]}
- ${p.points[1]}
- ${p.points[2]}

¿Le vendría bien una llamada gratuita de 15 minutos la próxima semana? Puedo compartir algunas ideas concretas para {{company}}, sin compromiso. Si lo prefiere, podemos hablar en inglés.

Un saludo,
{{agent_name}}
Standard Projects · standardprojects.org`,
  it: (p) => `Buongiorno,

ho visto {{company}} e ho dato un’occhiata alla vostra presenza online. ${p.hook}

Siamo Standard Projects, un piccolo studio che realizza siti veloci e ottimizzati per smartphone. Per ${p.who} questo di solito significa:
- ${p.points[0]}
- ${p.points[1]}
- ${p.points[2]}

Le andrebbe una chiamata gratuita di 15 minuti la prossima settimana? Posso condividere alcune idee concrete per {{company}}, senza impegno. Se preferisce, possiamo parlare in inglese.

Cordiali saluti,
{{agent_name}}
Standard Projects · standardprojects.org`,
  fr: (p) => `Bonjour,

J’ai découvert {{company}} et j’ai regardé votre présence en ligne. ${p.hook}

Nous sommes Standard Projects, un petit studio qui crée des sites rapides et adaptés au mobile. Pour les ${p.who}, cela signifie généralement :
- ${p.points[0]}
- ${p.points[1]}
- ${p.points[2]}

Un appel gratuit de 15 minutes la semaine prochaine vous serait-il utile ? Je peux vous présenter quelques idées concrètes pour {{company}}, sans engagement. Si vous préférez, nous pouvons échanger en anglais.

Cordialement,
{{agent_name}}
Standard Projects · standardprojects.org`,
};

/** US spelling for the US/Canada version; the pitches above are written that way. UK-style for everyone else. */
function britishSpelling(text: string): string {
  return text.replace(/inquir(y|ies)/g, (_m, end: string) => `enquir${end}`).replace(/Inquir(y|ies)/g, (_m, end: string) => `Enquir${end}`);
}

export type PackTemplate = {
  id: string; name: string; category: string; language: TemplateLanguage; countries: string[]; industries: string[]; subject: string; body: string;
};

/** Every template in the pack (10 industries × 7 country groups). */
export function industryTemplatePack(): PackTemplate[] {
  return PACK_INDUSTRIES.flatMap((industry) =>
    PACK_REGIONS.map((r) => {
      const p = PITCHES[industry][r.language as Lang];
      const fix = r.key === "uk" ? britishSpelling : (s: string) => s;
      return {
        id: `tpl_pack_${r.key}_${industry.toLowerCase().replace(/[^a-z]+/g, "_")}`,
        name: `Intro – ${industry.replace("-", " ")} – ${r.label}`,
        category: "Intro",
        language: r.language,
        countries: [...r.countries],
        industries: [industry],
        subject: fix(p.subject),
        body: fix(FRAMES[r.language as Lang](p)),
      };
    }),
  );
}
