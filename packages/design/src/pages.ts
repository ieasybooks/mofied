// Mofied's About, Privacy policy, Terms of use and Contact & support pages,
// with the text approved on 20 November 2026. mofied.com builds its pages from
// them (Arabic at /about, English at /en/about, and so on), and About in the
// apps and the web player shows them. Change a word only with an approved edit.
//
// Each string in paragraphs is one paragraph. [label](target) is a link, to a
// URL or, with page:<id>, to another of these pages in the same language.
// This file imports nothing, so that apps/web's Vite configuration, which
// builds the pages, can load it on its own.
export type Locale = "ar" | "en";
export const pageIds = ["about", "privacy", "terms", "support"] as const;
export type PageId = (typeof pageIds)[number];
export type PageSection = {
  /** Left out for the opening paragraphs. */
  heading?: string;
  paragraphs: readonly string[];
};
export type Page = {
  title: string;
  /** The "Last updated" line under the title. */
  updated?: string;
  sections: readonly PageSection[];
};

export const pages: Record<Locale, Record<PageId, Page>> = {
  ar: {
    about: {
      title: "عن مفيد",
      sections: [
        {
          paragraphs: [
            "مفيد مساحة لمشاهدة مواد إسلامية قصيرة ونافعة، تتخللها وقفات للقراءة والتفكر.",
          ],
        },
        {
          heading: "ما يقدّمه مفيد",
          paragraphs: [
            "مواد قصيرة لعدد من المتحدثين، تتخللها وقفات للقراءة بمؤقّت يمكنك إيقافه. ولكل جلسة نهاية واضحة، وتبدأ جلسة جديدة كلما فتحت مفيد.",
            "يتوفر مفيد بواجهة عربية وإنجليزية.",
          ],
        },
        {
          heading: "مصدر المحتوى",
          paragraphs: [
            "تُختار مواد مفيد من فقيه، وهو تطبيق آخر من الكتب المُيسّرة لا يُضاف إليه متحدث إلا بعد موافقة لجنة شرعية. وتُنسب كل مادة إلى صاحبها، مع رابط إلى صفحتها في فقيه.",
          ],
        },
        {
          heading: "مَن يطوّر مفيد",
          paragraphs: [
            "مفيد من تطوير الكتب المُيسّرة، وهو مجاني وخالٍ من الإعلانات، ويمكنك استخدامه دون حساب.",
            "تابع الكتب المُيسّرة على [تيليجرام](https://t.me/ieasybooks) و[يوتيوب](https://youtube.com/@ieasybooks) و[X](https://x.com/iieasybooks) و[فيسبوك](https://fb.com/ieasybooks) و[GitHub](https://github.com/ieasybooks).",
          ],
        },
      ],
    },
    privacy: {
      title: "سياسة الخصوصية",
      updated: "آخر تحديث: ٢٠ نوفمبر ٢٠٢٦",
      sections: [
        {
          paragraphs: [
            "تبيّن هذه السياسة كيف نتعامل مع المعلومات في تطبيق مفيد على iOS وAndroid وموقع mofied.com. مفيد من تطوير الكتب المُيسّرة، ويمكنك استخدامه دون حساب.",
          ],
        },
        {
          heading: "ما يُحفظ على جهازك",
          paragraphs: [
            "لا يحفظ مفيد شيئًا من تقدّمك أو إعداداتك، فكل مرة تفتح فيها التطبيق أو الموقع تبدأ جلسة جديدة.",
          ],
        },
        {
          heading: "ما يتلقاه خادمنا",
          paragraphs: [
            "كلما بدأت جلسة جديدة في مفيد، يتلقى خادمنا مع الطلب معلومات تقنية، مثل عنوان IP، ووقت الطلب، ونوع التطبيق أو المتصفح. ولا نستخدمها إلا لتشغيل مفيد وحمايته من إساءة الاستخدام وإصلاح الأعطال.",
          ],
        },
        {
          heading: "الإعلانات والإحصاءات",
          paragraphs: [
            "لا يعرض مفيد إعلانات، ولا يتتبّعك في التطبيقات أو المواقع الأخرى. ويجمع موقع mofied.com إحصاءات إجمالية عن زياراته وسرعة تحميل صفحاته، دون استخدام ملفات تعريف الارتباط. ولا نبيع أي بيانات، ولا نستخدمها لأغراض إعلانية.",
          ],
        },
        {
          heading: "الأذونات",
          paragraphs: [
            "لا يطلب مفيد إذن الوصول إلى موقعك الجغرافي أو الكاميرا أو الميكروفون أو جهات الاتصال.",
          ],
        },
        {
          heading: "التواصل وطلبات الخصوصية",
          paragraphs: [
            "إذا راسلتنا، نتلقى ما ترسله إلينا، كاسمك وبريدك الإلكتروني ونص رسالتك، ولا نستخدمه إلا للرد عليك. ولأي سؤال عن الخصوصية، أو لطلب حذف رسائلك، راسلنا على [easybooksdev@gmail.com](mailto:easybooksdev@gmail.com).",
          ],
        },
        {
          heading: "تحديثات هذه السياسة",
          paragraphs: [
            "ننشر في هذه الصفحة النسخة الحالية من هذه السياسة، مع تاريخ آخر تحديث لها.",
          ],
        },
      ],
    },
    terms: {
      title: "شروط الاستخدام",
      updated: "آخر تحديث: ٢٠ نوفمبر ٢٠٢٦",
      sections: [
        {
          paragraphs: [
            "تنظّم هذه الشروط استخدامك لتطبيق مفيد على iOS وAndroid وموقع mofied.com، ويُعدّ استخدامك له موافقةً عليها. مفيد من تطوير الكتب المُيسّرة، وهو مجاني.",
          ],
        },
        {
          heading: "استخدام مفيد",
          paragraphs: [
            "استخدم مفيد استخدامًا مشروعًا ولائقًا، ولا تحاول تعطيله، أو الوصول إلى أجزاء غير مسموح لك بها، أو إرسال طلبات كثيرة تُبطئه على المستخدمين الآخرين.",
          ],
        },
        {
          heading: "المحتوى والحقوق",
          paragraphs: [
            "ينسب مفيد كل مادة إلى صاحبها، مع رابط إلى صفحتها في فقيه. وتبقى الحقوق كلها لأصحابها، ولا يدّعي مفيد ملكية شيء منها.",
            "إذا كنت صاحب حق في مادة يعرضها مفيد، وأردت تصحيحها أو تعديل نسبتها أو حذفها، فراسلنا على [easybooksdev@gmail.com](mailto:easybooksdev@gmail.com)، وأرفق رابطها وبيّن صلتك بها. ونحن نراجع كل طلب ونتخذ الإجراء المناسب.",
          ],
        },
        {
          heading: "الدقة والتوافر",
          paragraphs: [
            "يُقدَّم مفيد مجانًا و«كما هو»، دون ضمانات من أي نوع. وقد يتغير محتواه أو يصبح غير متاح أو تقع فيه أخطاء، ولا نضمن أن يعمل دائمًا أو يخلو من الأعطال. وإن وجدت خطأ، فنرجو أن تبلغنا به.",
          ],
        },
        {
          heading: "حدود المسؤولية",
          paragraphs: [
            "في حدود ما يسمح به القانون، لا تتحمل الكتب المُيسّرة أي مسؤولية عن خسارة أو ضرر ينشأ عن استخدام مفيد أو محتواه، أو عن تعذّر استخدامهما.",
          ],
        },
        {
          heading: "تحديثات هذه الشروط",
          paragraphs: [
            "قد نحدّث هذه الشروط من حين لآخر، وننشر نسختها الحالية في هذه الصفحة مع تاريخ آخر تحديث. واستمرارك في استخدام مفيد بعد التحديث يعني قبولك للشروط المحدّثة.",
          ],
        },
        {
          heading: "التواصل",
          paragraphs: [
            "لأي سؤال عن هذه الشروط، راسلنا على [easybooksdev@gmail.com](mailto:easybooksdev@gmail.com).",
          ],
        },
      ],
    },
    support: {
      title: "التواصل والدعم",
      sections: [
        {
          paragraphs: [
            "مفيد من تطوير الكتب المُيسّرة. لأي سؤال أو اقتراح، أو للإبلاغ عن مشكلة أو خطأ، تواصل معنا.",
          ],
        },
        {
          heading: "راسلنا",
          paragraphs: [
            "بريدنا الإلكتروني للأسئلة والدعم وطلبات الخصوصية: [easybooksdev@gmail.com](mailto:easybooksdev@gmail.com). ويمكنك كذلك [فتح بلاغ على GitHub](https://github.com/ieasybooks/mofied/issues)، وهو علني، فلا تضع فيه معلومات شخصية.",
          ],
        },
        {
          heading: "الإبلاغ عن مشكلة",
          paragraphs: [
            "إن كانت ملاحظتك عن شيء محدد في مفيد، فأرسل رابطه أو أخبرنا بمكانه. وإن كانت المشكلة في عمل التطبيق أو الموقع، فاذكر نوع جهازك، وإصدار نظام تشغيله، وإصدار مفيد، وما حدث قبل ظهورها. ولا ترسل إلينا كلمات مرور أو أي معلومات حساسة.",
          ],
        },
        {
          heading: "المحتوى والحقوق",
          paragraphs: [
            "إذا كنت صاحب حق في مادة يعرضها مفيد، فراجع قسم «المحتوى والحقوق» في [شروط الاستخدام](page:terms)، أو راسلنا.",
          ],
        },
        {
          heading: "الخصوصية",
          paragraphs: [
            "يمكنك استخدام مفيد دون حساب، وهو لا يتتبّعك في التطبيقات أو المواقع الأخرى. ولمعرفة كيف نتعامل مع المعلومات، أو لتقديم طلب يتعلق بالخصوصية، راجع [سياسة الخصوصية](page:privacy).",
          ],
        },
      ],
    },
  },
  en: {
    about: {
      title: "About Mofied",
      sections: [
        {
          paragraphs: [
            "Mofied is a place to watch short, useful Islamic media, with pauses to read and reflect along the way.",
          ],
        },
        {
          heading: "What's in Mofied",
          paragraphs: [
            "Short media from a range of speakers, with reading pauses between them whose timer you can stop. Each session has a clear end, and a new one starts every time you open Mofied.",
            "Its interface is in Arabic and English.",
          ],
        },
        {
          heading: "Where the content comes from",
          paragraphs: [
            "Mofied's media come from Faqieh, another EasyBooks app, whose speakers are approved by a Sharia committee. Each item is credited to its speaker and links to its page on Faqieh.",
          ],
        },
        {
          heading: "Who makes it",
          paragraphs: [
            "Mofied is made by EasyBooks. It's free, has no ads and works without an account.",
            "Follow EasyBooks on [Telegram](https://t.me/ieasybooks), [YouTube](https://youtube.com/@ieasybooks), [X](https://x.com/iieasybooks), [Facebook](https://fb.com/ieasybooks) and [GitHub](https://github.com/ieasybooks).",
          ],
        },
      ],
    },
    privacy: {
      title: "Privacy policy",
      updated: "Last updated: 20 November 2026",
      sections: [
        {
          paragraphs: [
            "This policy explains how the Mofied apps for iOS and Android and the mofied.com website handle information. Mofied is made by EasyBooks, and you can use it without an account.",
          ],
        },
        {
          heading: "Information stored on your device",
          paragraphs: [
            "Mofied doesn't save your progress or settings: a new session starts every time you open the app or the site.",
          ],
        },
        {
          heading: "Information our server receives",
          paragraphs: [
            "Each time Mofied loads a session, our server receives technical details with the request, such as your IP address, the time and your app or browser. We use them only to run Mofied, protect it from abuse and fix problems.",
          ],
        },
        {
          heading: "Advertising and analytics",
          paragraphs: [
            "Mofied has no ads and doesn't track you across apps or websites. The mofied.com website keeps aggregate statistics on its visits and loading speed, without cookies. We don't sell any data or use it for advertising.",
          ],
        },
        {
          heading: "Permissions",
          paragraphs: [
            "Mofied doesn't ask for access to your location, camera, microphone or contacts.",
          ],
        },
        {
          heading: "Contact and privacy requests",
          paragraphs: [
            "If you write to us, we receive what you send, such as your name, email address and message, and use it only to reply to you. To ask about privacy, or to have your messages deleted, email [easybooksdev@gmail.com](mailto:easybooksdev@gmail.com).",
          ],
        },
        {
          heading: "Changes to this policy",
          paragraphs: [
            "We publish the current version of this policy, and the date it was last updated, on this page.",
          ],
        },
      ],
    },
    terms: {
      title: "Terms of use",
      updated: "Last updated: 20 November 2026",
      sections: [
        {
          paragraphs: [
            "These terms cover your use of the Mofied apps for iOS and Android and the mofied.com website. By using Mofied, you agree to them. Mofied is made by EasyBooks and is free.",
          ],
        },
        {
          heading: "Using Mofied",
          paragraphs: [
            "Use Mofied lawfully and respectfully. Don't disrupt it, try to get into parts of it you aren't allowed to reach, or send it so many requests that it slows down for others.",
          ],
        },
        {
          heading: "Content and rights",
          paragraphs: [
            "Mofied credits each item to its speaker and links to its page on Faqieh. Their rights stay with their owners, and Mofied claims no ownership of them.",
            "If you own rights in something Mofied shows and want it corrected, credited differently or removed, email [easybooksdev@gmail.com](mailto:easybooksdev@gmail.com) with a link to it and your relationship to it. We review every request and act on it.",
          ],
        },
        {
          heading: "Accuracy and availability",
          paragraphs: [
            "Mofied is provided free and as is, without warranties of any kind. Its content may change, become unavailable or contain mistakes, and we don't guarantee that it will always work or be free of errors. If you find a mistake, please report it.",
          ],
        },
        {
          heading: "Limitation of liability",
          paragraphs: [
            "As far as the law allows, EasyBooks isn't liable for any loss or damage arising from using, or being unable to use, Mofied or its content.",
          ],
        },
        {
          heading: "Changes to these terms",
          paragraphs: [
            "We may update these terms. We publish the current version here, with the date it was last updated. Continuing to use Mofied after an update means you accept it.",
          ],
        },
        {
          heading: "Contact",
          paragraphs: [
            "For questions about these terms, email [easybooksdev@gmail.com](mailto:easybooksdev@gmail.com).",
          ],
        },
      ],
    },
    support: {
      title: "Contact & support",
      sections: [
        {
          paragraphs: [
            "Mofied is made by EasyBooks. For questions and suggestions, or to report a problem or a mistake, contact us.",
          ],
        },
        {
          heading: "Email us",
          paragraphs: [
            "Our address for questions, support and privacy requests: [easybooksdev@gmail.com](mailto:easybooksdev@gmail.com). You can also [open an issue on GitHub](https://github.com/ieasybooks/mofied/issues); it's public, so keep personal information out of it.",
          ],
        },
        {
          heading: "Reporting a problem",
          paragraphs: [
            "If it's about something specific in Mofied, send its link or tell us where to find it. If it's about the app or the website, include your device, its operating system version, Mofied's version and what happened before it. Don't send passwords or sensitive information.",
          ],
        },
        {
          heading: "Content and rights",
          paragraphs: [
            "If you own rights in something Mofied shows, see “Content and rights” in [the terms of use](page:terms), or email us.",
          ],
        },
        {
          heading: "Privacy",
          paragraphs: [
            "Mofied works without an account and doesn't track you across apps or websites. For how we handle information, or for a privacy request, see [the privacy policy](page:privacy).",
          ],
        },
      ],
    },
  },
};

export type Inline =
  | { text: string }
  | { text: string; href: string }
  | { text: string; page: PageId };

const isPageId = (value: string): value is PageId =>
  (pageIds as readonly string[]).includes(value);

/** A paragraph's text and links, in order. */
export function inline(paragraph: string): Inline[] {
  const parts: Inline[] = [];
  let end = 0;
  for (const match of paragraph.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    const [link, text, target] = match;
    if (match.index > end)
      parts.push({ text: paragraph.slice(end, match.index) });
    if (target.startsWith("page:")) {
      const page = target.slice("page:".length);
      if (!isPageId(page)) throw new Error(`No page called ${page}`);
      parts.push({ text, page });
    } else parts.push({ text, href: target });
    end = match.index + link.length;
  }
  if (end < paragraph.length) parts.push({ text: paragraph.slice(end) });
  return parts;
}

/** The page's path on mofied.com: Arabic at the root, English under /en. */
export function pagePath(id: PageId, locale: Locale) {
  return locale === "ar" ? `/${id}` : `/en/${id}`;
}
