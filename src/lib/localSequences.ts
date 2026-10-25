/**
 * Four-email sequences in Spanish, Italian and French (intro, nudge, examples, last email), so leads in those
 * countries get the whole series in their own language. Added once, like the industry template pack.
 */
import type { TemplateLanguage } from "./templates";

type Email = { name: string; category: string; subject: string; body: string };
type LocalSequence = { language: TemplateLanguage; country: string; name: string; description: string; emails: [Email, Email, Email, Email] };

const SIGN = "{{agent_name}}\nStandard Projects · standardprojects.org";

export const LOCAL_SEQUENCES: LocalSequence[] = [
  {
    language: "es",
    country: "Spain",
    name: "Captación web (Español, 4 emails)",
    description: "For leads in Spain: intro, a nudge after 3 days, examples after a week, and a polite last email. Stops as soon as they reply.",
    emails: [
      {
        name: "Idea para su web (Español)",
        category: "Intro",
        subject: "Una idea rápida para la web de {{company}}",
        body: `Buenos días,

He visto {{company}} y he echado un vistazo a su presencia online. Creo que una web moderna podría traerles bastantes más consultas y reservas.

Somos Standard Projects, un pequeño estudio que crea webs rápidas y adaptadas al móvil. Para negocios como el suyo, eso suele significar:
- una web clara que funciona perfectamente en cualquier móvil
- reservas online o formularios de contacto que llegan directamente a su correo
- aparecer bien en Google y Google Maps

¿Le vendría bien una llamada gratuita de 15 minutos la próxima semana? Puedo compartir algunas ideas concretas para {{company}}, sin compromiso. Si lo prefiere, podemos hablar en inglés.

Un saludo,
${SIGN}`,
      },
      {
        name: "Seguimiento (Español)",
        category: "Follow-up",
        subject: "Re: Una idea rápida para la web de {{company}}",
        body: `Buenos días,

Solo quería recuperar mi mensaje anterior. Si le resulta más cómodo que una llamada, puedo enviarle algunos ejemplos de webs que hemos hecho para negocios similares.

Un saludo,
{{agent_name}}`,
      },
      {
        name: "Ejemplos (Español)",
        category: "Case study",
        subject: "Cómo negocios similares consiguen más reservas",
        body: `Buenos días,

Hemos creado webs y sistemas de reservas para spas, cafeterías, tiendas y empresas de servicios. Puede ver algunos ejemplos aquí: standardprojects.org/portfolio

Podríamos hacer algo parecido para {{company}}, con un precio cerrado acordado de antemano, y la web sería totalmente suya.

¿Quiere que le prepare una propuesta rápida y sin compromiso?

Un saludo,
${SIGN}`,
      },
      {
        name: "Último email (Español)",
        category: "Break-up",
        subject: "Mi último mensaje",
        body: `Buenos días,

Como no he recibido respuesta, entiendo que ahora no es buen momento y no volveré a escribirle.

Si más adelante una nueva web para {{company}} vuelve a ser una prioridad, responda a este correo y me pondré en contacto enseguida.

Un saludo,
{{agent_name}}`,
      },
    ],
  },
  {
    language: "it",
    country: "Italy",
    name: "Contatto sito web (Italiano, 4 email)",
    description: "For leads in Italy: intro, a nudge after 3 days, examples after a week, and a polite last email. Stops as soon as they reply.",
    emails: [
      {
        name: "Idea per il sito (Italiano)",
        category: "Intro",
        subject: "Un’idea veloce per il sito di {{company}}",
        body: `Buongiorno,

ho visto {{company}} e ho dato un’occhiata alla vostra presenza online. Credo che un sito moderno potrebbe portarvi molte più richieste e prenotazioni.

Siamo Standard Projects, un piccolo studio che realizza siti veloci e ottimizzati per smartphone. Per attività come la vostra questo di solito significa:
- un sito chiaro che funziona perfettamente su ogni smartphone
- prenotazioni online o moduli di contatto che arrivano direttamente nella vostra casella
- una buona visibilità su Google e Google Maps

Le andrebbe una chiamata gratuita di 15 minuti la prossima settimana? Posso condividere alcune idee concrete per {{company}}, senza impegno. Se preferisce, possiamo parlare in inglese.

Cordiali saluti,
${SIGN}`,
      },
      {
        name: "Promemoria (Italiano)",
        category: "Follow-up",
        subject: "Re: Un’idea veloce per il sito di {{company}}",
        body: `Buongiorno,

volevo solo riportare in cima il mio messaggio precedente. Se è più comodo di una chiamata, posso inviarle alcuni esempi di siti che abbiamo realizzato per attività simili.

Cordiali saluti,
{{agent_name}}`,
      },
      {
        name: "Esempi (Italiano)",
        category: "Case study",
        subject: "Come attività simili ottengono più prenotazioni",
        body: `Buongiorno,

abbiamo realizzato siti e sistemi di prenotazione per spa, caffè, negozi e aziende di servizi. Alcuni esempi sono qui: standardprojects.org/portfolio

Potremmo fare qualcosa di simile per {{company}}, a un prezzo fisso concordato in anticipo, e il sito sarebbe interamente vostro.

Vuole che le prepari una proposta rapida e senza impegno?

Cordiali saluti,
${SIGN}`,
      },
      {
        name: "Ultima email (Italiano)",
        category: "Break-up",
        subject: "Il mio ultimo messaggio",
        body: `Buongiorno,

non avendo ricevuto risposta, immagino che ora non sia il momento giusto e non le scriverò più.

Se in futuro un nuovo sito per {{company}} dovesse tornare tra le priorità, risponda pure a questa email e mi farò sentire subito.

Cordiali saluti,
{{agent_name}}`,
      },
    ],
  },
  {
    language: "fr",
    country: "France",
    name: "Prospection site web (Français, 4 e-mails)",
    description: "For leads in France: intro, a nudge after 3 days, examples after a week, and a polite last email. Stops as soon as they reply.",
    emails: [
      {
        name: "Idée pour votre site (Français)",
        category: "Intro",
        subject: "Une idée rapide pour le site de {{company}}",
        body: `Bonjour,

J’ai découvert {{company}} et j’ai regardé votre présence en ligne. Je pense qu’un site moderne pourrait vous apporter nettement plus de demandes et de réservations.

Nous sommes Standard Projects, un petit studio qui crée des sites rapides et adaptés au mobile. Pour une entreprise comme la vôtre, cela signifie généralement :
- un site clair qui fonctionne parfaitement sur tous les téléphones
- la réservation en ligne ou des formulaires de contact qui arrivent directement dans votre boîte mail
- une bonne visibilité sur Google et Google Maps

Un appel gratuit de 15 minutes la semaine prochaine vous serait-il utile ? Je peux vous présenter quelques idées concrètes pour {{company}}, sans engagement. Si vous préférez, nous pouvons échanger en anglais.

Cordialement,
${SIGN}`,
      },
      {
        name: "Relance (Français)",
        category: "Follow-up",
        subject: "Re: Une idée rapide pour le site de {{company}}",
        body: `Bonjour,

Je me permets de faire remonter mon précédent message. Si c’est plus simple qu’un appel, je peux vous envoyer quelques exemples de sites que nous avons réalisés pour des entreprises similaires.

Cordialement,
{{agent_name}}`,
      },
      {
        name: "Exemples (Français)",
        category: "Case study",
        subject: "Comment des entreprises similaires obtiennent plus de réservations",
        body: `Bonjour,

Nous avons créé des sites et des systèmes de réservation pour des spas, des cafés, des boutiques et des entreprises de services. Quelques exemples ici : standardprojects.org/portfolio

Nous pourrions faire de même pour {{company}}, à un prix fixe convenu à l’avance, et le site vous appartiendrait entièrement.

Souhaitez-vous que je vous prépare une proposition rapide et sans engagement ?

Cordialement,
${SIGN}`,
      },
      {
        name: "Dernier e-mail (Français)",
        category: "Break-up",
        subject: "Mon dernier message",
        body: `Bonjour,

N’ayant pas eu de réponse, je suppose que ce n’est pas le bon moment et je ne vous écrirai plus.

Si un nouveau site pour {{company}} redevient une priorité, répondez simplement à cet e-mail et je reviendrai vers vous rapidement.

Cordialement,
{{agent_name}}`,
      },
    ],
  },
];

/** Days to wait before each email (the same rhythm as the English sequence). */
export const LOCAL_WAIT_DAYS = [0, 3, 4, 7];
