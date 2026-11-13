"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Clock, Images, Quote, Sparkles } from "lucide-react";
import type { PersonSummary } from "@/lib/people";
import { PersonAvatar } from "@/components/people/PersonAvatar";

type Category = "Plenary" | "Showcase" | "Networking" | "Panel" | "Breakout";

interface RecapSpeaker { name: string; role: string; avatar?: string }
interface RecapOrg { name: string; logo: string; points: string[]; quote?: string }

interface SessionRecap {
  id: string;
  time: string;
  category: Category;
  title: string;
  photo?: { src: string; alt: string; position?: string };
  speakers?: RecapSpeaker[];
  lead: string;
  stats?: { value: string; label: string }[];
  points?: string[];
  orgs?: RecapOrg[];
  quote?: { text: string; by: string };
}

interface DayRecap {
  theme: string;
  intro: string;
  photosUrl?: string;
  stats: { value: string; label: string }[];
  sessions: SessionRecap[];
  /** Sessions from the day that these notes do not cover yet. */
  notCovered?: string;
}

// Summarised from the recording of the Day 1 opening plenary (9 November 2026).
// Quotes are lightly cleaned from the transcript; everything else is paraphrased.
const RECAPS: Record<string, DayRecap> = {
  "Day 1": {
    theme: "Partnerships for Lasting Change",
    // Full Day 1 photo set in the shared Google Drive folder.
    photosUrl: "https://drive.google.com/drive/folders/1Mel8hDoFqxg6Pb-ZXyXk0NHXxSk2mQq2",
    intro: "The second Oak Foundation Zimbabwe Country Programme grantee convening opened with welcomes from Oak's leadership, an overview of the Zimbabwe programme, two grantee showcases and speed networking. It is the first time partners have met since the last convening three years ago.",
    stats: [
      { value: "2nd", label: "Zimbabwe grantee convening" },
      { value: "36", label: "Direct grantees" },
      { value: "~25", label: "Sub-grantees" },
      { value: "3", label: "Main funding areas" },
    ],
    sessions: [
      {
        id: "welcome",
        time: "15:10",
        category: "Plenary",
        title: "Welcome from Oak's President",
        photo: { src: "/api/programme/photos/day1/doug-griffiths.jpg", alt: "Doug Griffiths addressing the room by video link from Geneva", position: "50% 30%" },
        speakers: [{ name: "Doug Griffiths", role: "President, Oak Foundation (by video from Geneva)", avatar: "/api/programme/photos/day1/doug-griffiths-avatar.jpg" }],
        lead: "Doug set out the theme of the gathering and what Oak wants partnership to mean in practice.",
        points: [
          "Oak's Zimbabwe programme supports partners to build prosperous, inclusive and sustainable communities, part of Oak's wider vision of a safer, fairer and more sustainable world.",
          "Organisations rooted in their communities are central. Oak's role is to listen, learn and support partners in turning their knowledge into lasting progress.",
          "Good partnership depends on trust and honest dialogue. Oak wants to be clear about its strategy and processes, and genuinely wants to hear partners' questions and experience.",
          "Oak is committed to more flexible, multi-year support that backs organisations as a whole, not only individual projects.",
          "Hope for the convening: stronger connections, a clearer understanding of Oak, and ideas for working together beyond these few days.",
        ],
        quote: { text: "Funding alone does not make a partnership. How we provide it and the relationships that accompany it can make a meaningful difference.", by: "Doug Griffiths" },
      },
      {
        id: "oak-intro",
        time: "15:15",
        category: "Plenary",
        title: "Introduction to Oak Foundation",
        photo: { src: "/api/programme/photos/day1/cheryl-chang.jpg", alt: "Cheryl Chang speaking at the podium", position: "35% 25%" },
        speakers: [{ name: "Cheryl Chang", role: "Chief of Staff, Oak Foundation", avatar: "/api/programme/photos/day1/cheryl-chang-avatar.jpg" }],
        lead: "Cheryl gave the background of the wider foundation and why Zimbabwe sits at the heart of its work.",
        stats: [
          { value: "40+", label: "Years of grant making" },
          { value: "~US$400m", label: "Grants a year" },
          { value: "8", label: "Main programmes" },
          { value: "95+", label: "Staff, 37 nationalities" },
        ],
        points: [
          "Oak is a family-led foundation founded by Alan and Jette Parker, with resources from Alan Parker's interest in Duty Free Shoppers. The family are the trustees and the funding areas reflect their interests.",
          "Alan Parker grew up in Zimbabwe, which is why Oak has a dedicated country programme here. Zimbabwe has been part of Oak's work from the very beginning.",
          "Named after the oak tree: strength, resilience, longevity and protection, flourishing from generation to generation.",
          "Headquarters in Geneva, offices in the US and UK, and country offices in Denmark and Zimbabwe (3 staff in Harare).",
          "Other Oak programmes, such as Environment and Special Interest, also fund work in Zimbabwe.",
          "Cheryl will present Oak's communications approach, including how Oak lifts up grantee stories, later in the convening.",
        ],
        quote: { text: "At Oak Foundation, we really believe that the work is done by our grantees.", by: "Cheryl Chang" },
      },
      {
        id: "zim-programme",
        time: "15:20",
        category: "Plenary",
        title: "The Oak Zimbabwe Programme",
        photo: { src: "/api/programme/photos/day1/karl-riber.jpg", alt: "Karl Riber presenting the Oak Zimbabwe programme", position: "45% 25%" },
        speakers: [{ name: "Karl Riber", role: "Head of Office, Oak Zimbabwe", avatar: "/api/programme/photos/day1/karl-riber-avatar.jpg" }],
        lead: "Karl, six months into the role after 22 years in the sector, walked through how the Zimbabwe portfolio works today.",
        points: [
          "Three main funding areas: helping families and communities thrive; supporting children and adults with special needs (the longest-running area, with partners since the 1990s); and improving livelihoods through skills building and entrepreneurship (the fastest growing).",
          "Trustees Christopher and Sebastian, grandsons of the founders, follow the programme closely and visit Zimbabwe regularly.",
          "Opportunistic grants of a year or two, often trustee-initiated, can transition into the main programme.",
          "Oak aims for long-term, flexible core support. With other funding drying up, Oak is also connecting partners with other philanthropies and giving recommendations.",
          "With a team of three, Oak relies on stronger organisations to act as intermediaries for sub-grantees. That role ranges from fiscal host to hands-on support with policies, boards and organisational development.",
          "Reporting is deliberately light and not prescriptive. Oak wants clearer expectations between intermediaries and sub-grantees and asked partners to share where things are not working.",
        ],
        quote: { text: "See how we can do more, not just through funding, but what else can we do to try to help.", by: "Karl Riber" },
      },
      {
        id: "showcase",
        time: "15:30",
        category: "Showcase",
        title: "Grantee showcase",
        lead: "Two short films showed Oak-supported work on the ground.",
        orgs: [
          {
            name: "Uncommon.org",
            logo: "/logos/uncommon.svg",
            points: [
              "Building tech skills so young Zimbabweans, including young women, can earn and compete.",
              "Africa contributes only around 2% of the global economy; skills are part of changing that.",
            ],
            quote: "Zimbabwe has been known as the most literate country in Africa, and we would like it also known for being the most tech literate.",
          },
          {
            name: "JF Kapnek Zimbabwe",
            logo: "/logos/jf-kapnek.png",
            points: [
              "Rehabilitation and developmental support for children with disabilities, plus assessments and positive parenting support for caregivers.",
              "Monthly outreach clinics mobilised by community-based rehabilitation workers, and district-level coordination focused on early intervention.",
            ],
          },
        ],
      },
      {
        id: "networking",
        time: "16:00",
        category: "Networking",
        title: "Speed networking and 1:1 meetings",
        photo: { src: "/api/programme/photos/day1/ronald-nyamukuwa.jpg", alt: "Ronald Nyamukuwa of the coordination team addressing delegates", position: "50% 25%" },
        speakers: [{ name: "Ronald Nyamukuwa", role: "Coordination Team, Uncommon", avatar: "/api/programme/photos/day1/ronald-nyamukuwa-avatar.jpg" }],
        lead: "Asked to sum up the opening, participants highlighted Oak listening to partners' needs and its flexibility. Delegates then moved out to the deck for speed networking.",
        points: [
          "Speed networking, facilitated by co-MC Kisani (Uncommon), to get to know each other and spot areas for collaboration.",
          "Pre-booked 1:1 meetings with Oak staff followed in the breakout room.",
          "Thanks to the Oak Zimbabwe team (Karl, Arnette and Mercy), Silvia and Alice from Oak HQ, and Michelle Gwatiringa and the Uncommon team for organising the convening.",
        ],
      },
    ],
  },
  // Summarised from the Day 2 recordings (10 November 2026): morning plenary (showcases and keynote panel),
  // both rounds of the Alternative Funding Models breakout, and the afternoon plenary review with Oak's Q&A.
  "Day 2": {
    theme: "Beyond Funding: Building Resilient Partnerships",
    intro: "Day 2 moved from listening to doing. Two more grantee showcases opened the morning, a panel of four grantees unpacked what real partnership looks like, and breakout tracks on evidence, alternative funding and resource mobilisation fed into an afternoon plenary where Oak answered partners' questions directly.",
    stats: [
      { value: "2", label: "Grantee showcases" },
      { value: "4", label: "Grantee panellists" },
      { value: "3", label: "Breakout tracks" },
      { value: "2", label: "Breakout rounds" },
    ],
    sessions: [
      {
        id: "d2-showcase",
        time: "08:30",
        category: "Showcase",
        title: "Grantee showcase: Ele Collection and Young Africa",
        lead: "Two short films opened the day, followed by a few words from Ele Collection's founder.",
        orgs: [
          {
            name: "Ele Collection",
            logo: "/logos/ele-collection.png",
            points: [
              "A Victoria Falls movement that collects any plastic, clean or dirty, and turns it into building aggregate, mostly through women collectors who earn from every kilogram.",
              "Only 2 of the 7 plastic types used in Africa can be recycled, which keeps recycling rates in Zimbabwe and Southern Africa at around 3 to 5%.",
              "Reducing poverty also reduces poaching and conflict between people and wildlife.",
            ],
          },
          {
            name: "Young Africa",
            logo: "/logos/young-africa.svg",
            points: [
              "The Integral Training Model builds skills of the hands, mind and heart: technical and digital skills, entrepreneurship, life skills, health and psychosocial support.",
              "Training is 70% practical and 30% theory, with hostels for girls and creches for young mothers, plus mobile units that reach rural areas, border towns and conflict zones.",
              "70% of graduates find work or start a business within six months of finishing.",
            ],
          },
        ],
      },
      {
        id: "d2-panel",
        time: "09:00",
        category: "Panel",
        title: "Keynote panel: Beyond funding, building resilient partnerships",
        speakers: [
          { name: "Michelle Gwatiringa", role: "Country Director, Uncommon (moderator)" },
          { name: "Charity Bafana", role: "Restless Development" },
          { name: "Natalie Simbini", role: "Friendship Bench" },
          { name: "Rati Moyo", role: "Childline Zimbabwe" },
          { name: "Tatenda Songore", role: "Youth Advocates" },
        ],
        lead: "Four grantees talked about partnership and practice: what support beyond money matters, how trust survives change, and how impact outlasts a grant.",
        orgs: [
          {
            name: "Charity Bafana, Restless Development",
            logo: "/logos/restless-development.svg",
            points: [
              "Oak's support after signing made the difference: safeguarding training now used in communities, and a funder-mapping tool used across their network.",
              "Long, complex applications put off new and smaller organisations. Clinics or support to ease them in would help.",
              "Sustainability means building unrestricted income, exploring social enterprise and applying together as consortia.",
            ],
          },
          {
            name: "Natalie Simbini, Friendship Bench",
            logo: "/logos/friendship-bench.png",
            points: [
              "Oak shows up as a peer. Being honest about your North Star and long-term needs builds trust.",
              "Open your networks: introducing a peer to your funder costs you nothing.",
              "Treat government as a co-financing partner, and look after staff carrying extra roles after last year's cuts.",
            ],
            quote: "I lose nothing by introducing.",
          },
          {
            name: "Rati Moyo, Childline Zimbabwe",
            logo: "/logos/childline.png",
            points: [
              "Oak asked what Childline does best and what stops it, then funded that instead of a fixed call.",
              "Oak urged partners to diversify about two years before the US funding stop orders. Funding changed, but the problem being solved did not.",
              "Grantees should build their own platforms to work together, not only meet when there is a call.",
            ],
            quote: "We have this saying that we eat what we kill. It is about time we change that and say, we live what we sow.",
          },
          {
            name: "Tatenda Songore, Youth Advocates",
            logo: "/logos/youth-advocates.png",
            points: [
              "A true partner shows up in a crisis. Oak grants kept some organisations open during the global funding cuts.",
              "Plans need room to adapt when context shifts, such as demolitions or currency changes, so partners can co-create solutions with Oak.",
              "Map which partners work in which districts, and build government systems that outlive projects.",
            ],
          },
        ],
        points: [
          "What kills a partnership: contact only at reporting time, no evidence of impact, becoming irrelevant, mistrust, and a partnership that ends when the grant ends.",
          "Biggest opportunity of the convening: meeting organisations you would never meet otherwise and finding synergies, from shared spaces to joint bids.",
        ],
      },
      {
        id: "d2-mel",
        time: "10:30",
        category: "Plenary",
        title: "Monitoring, Evaluation & Learning at Oak",
        speakers: [{ name: "Silvia Guizzardi", role: "Senior Adviser for Impact, Oak Foundation (Geneva)" }],
        lead: "Silvia explained Oak's approach to monitoring, evaluation and learning (MEL) and what it means for grantees at each stage of a grant. The slides will be shared on the platform.",
        stats: [
          { value: "0", label: "Required indicators or KPIs" },
          { value: "2", label: "Questions in an annual progress report" },
          { value: "~60%", label: "Of Oak's grant making is core funding" },
          { value: "~500", label: "Oak grants supported by one MEL adviser" },
        ],
        points: [
          "MEL helps track progress, learn what works and what doesn't (failures teach as much as successes), make decisions, and show your impact to other funders.",
          "Oak's principles: keep the reporting burden low, align with your own MEL systems, collect only data you use, keep it proportionate to your size and grant, and adapt as things change.",
          "What Oak most wants to hear is the change you are contributing to, in your own words, and what you are learning. You report contribution, not sole attribution.",
          "In applications: your long-term impact (your mission, for core grants), up to three grant-specific objectives, a brief approach and your MEL approach. Budget for baselines, evaluations and MEL capacity strengthening.",
          "Progress reports ask how you are progressing against your objectives and what challenges you faced. End-of-grant reports add overall impact and key lessons. Share stories and videos any time.",
          "A good impact story covers the problem and opportunity, context and partners, what you did, what changed and for whom, and the evidence. Qualitative evidence, community voices and secondary data (such as school attendance or satellite images) all count.",
          "In Q&A: core funding needs no justification (project funding does), and Oak's research shows core funding works. Intermediaries face three levels of reporting, an area Oak wants to explore. Sub-grantees should go to their intermediary first.",
        ],
        quote: { text: "Qualitative evidence is as important as quantitative. Get the communities that you are supporting talking.", by: "Silvia Guizzardi" },
      },
      {
        id: "d2-od",
        time: "11:15",
        category: "Plenary",
        title: "Organisational Development at Oak",
        speakers: [{ name: "Alice Gentile", role: "Adviser for Organisational Development, Oak Foundation" }],
        lead: "Alice presented, on behalf of her colleague Adriana, how Oak supports the organisations behind the programmes, not just the programmes themselves.",
        stats: [
          { value: "7", label: "Guiding principles" },
          { value: "18", label: "Areas Oak can support" },
          { value: "3", label: "Routes to support" },
        ],
        points: [
          "Organisational strengthening starts from your mission, strengths and challenges. It is a change process over time, not a one-off workshop.",
          "Seven principles: co-creation, ownership, trust (start from strengths, never fault-finding), localised (it must fit Zimbabwe), equity (whose voices shape it), collaboration and an integrated, strategic approach.",
          "The organisation as an onion: resources, then skills, systems and strategy, with identity, values, culture, leadership and governance at the core. Don't jump from one symptom to one fix, as challenges like fundraising touch every layer.",
          "18 areas of support in three groups: direction and influence (strategy, board, leadership, fundraising, advocacy), people and programme quality (HR, wellbeing, inclusion, safeguarding, programme management, MEL), and systems and infrastructure (compliance, IT, security, finance, communications, research).",
          "Three routes: strengthening built into project or core grants, or a dedicated OD grant; specialist providers and intermediaries such as Africa Ahead, CAFOD, HOSPAZ and Foundations for Farming; and peer learning like this convening.",
          "Examples from 2025: Simukai built a three-year strategy that led to new partnerships with UNICEF, Young Africa and Save the Children; Island Hospice combined strategic planning, fundraising and clinical skills; Childline's work with the Resource Alliance brought more board involvement in fundraising.",
          "Four questions to start: What already works well? Which priority would make the biggest difference now? What change do you want to see? What support and time would help?",
          "In Q&A: partners asked for peer help in shocks like last year's cuts (Oak is building wellbeing support), shared due diligence standards across funders (Oak is working on this within philanthropy first), and a map of partners' focus areas.",
        ],
        quote: { text: "I see OD as a process rather than a project.", by: "A grantee in the Q&A" },
      },
      {
        id: "d2-alt-funding",
        time: "12:00 and 14:15",
        category: "Breakout",
        title: "Breakout: Alternative funding models",
        lead: "Three organisations shared how they earn income beyond grants. The track ran twice, with open questions from the room.",
        orgs: [
          {
            name: "Simon Teede, Ele Collection",
            logo: "/logos/ele-collection.png",
            points: [
              "A social enterprise collecting about 50 tonnes of plastic a month, roughly half the waste of Victoria Falls and Hwange, aiming for 100 tonnes by Q3 next year.",
              "Companies fund from three budget lines: sales, marketing and CSR. Sales and marketing budgets are larger and steadier, so pitch to those.",
              "Your story is your unique selling point. Ele sells aggregate through partners' marketing budgets at many times the price of ordinary aggregate.",
            ],
            quote: "Sell the meaning and you'll get the fund.",
          },
          {
            name: "Lloyd Masunda, SAT",
            logo: "/logos/sat.jpg",
            points: [
              "SAT set up a separate company to protect donor money and its non-profit registration, then co-owns agribusinesses with farmer associations.",
              "Sesame Africa grew from 21 tonnes in 2023 to 610 tonnes in 2026 with over 14,000 smallholder farmers, and paid its first dividend from 2025 profits.",
              "The value of donor-funded assets goes to farmers as shares, which SAT matches with land, expertise and sweat equity.",
            ],
          },
          {
            name: "Island Hospice",
            logo: "/logos/island-hospice.png",
            points: [
              "Palliative care since 1979. Means-tested fees let patients who can pay subsidise those who cannot.",
              "An external expert helped launch a nursing agency in 2015. Social enterprises (nursing, equipment hire, patient escort) now bring in close to 40% of income.",
              "A pharmacy and a physiotherapy centre are next. It took about seven years to get right, and paying clients expect commercial quality.",
            ],
            quote: "It was never free. It's only that there was someone who was paying for that service.",
          },
        ],
        points: [
          "Biggest risks: getting the market wrong, losses when there are no reserves, and donors misunderstanding the model.",
          "Ideas from the room: medical aid claims, branded subscriptions from companies, and seed grants for assets that later attract loans and investors.",
        ],
      },
      {
        id: "d2-evidence",
        time: "12:00 and 14:15",
        category: "Breakout",
        title: "Breakout: Evidence-based impact",
        lead: "Four speakers shared how to generate evidence that is useful, proportionate and owned by the people doing the work, followed by small-group discussions. The track ran in both the morning and afternoon rounds.",
        orgs: [
          {
            name: "Silvia Guizzardi, Oak Foundation",
            logo: "/logos/oak.png",
            points: [
              "Much of the impact partners seek will outlast any grant, so also show the progress and pathways leading to it.",
              "Evidence is what you do with data: analysing and interpreting it. Collecting lots of data you never use helps no one.",
              "Start with the questions, then choose indicators: what donors need to know, what you need to know to track progress, and what you want to learn. Use data others already collect too.",
            ],
            quote: "If you are collecting data and you realise you're not making use of it, just stop collecting it.",
          },
          {
            name: "Eleonora Aralla, CAFOD",
            logo: "/logos/cafod.svg",
            points: [
              "CAFOD works only through local partners, so it asks who gets to define impact and evidence in the first place.",
              "With Caritas Chinhoyi and a local chief in Rushinga, child marriages fell to zero in the wards they work in after three years of Oak support, but early pregnancies did not. Standard frameworks miss stories like this.",
              "Flexible funding needs a deliberate plan for evidence from the start. Otherwise local partners finish a programme with nothing to show the next funder, so evidence should serve them, not just keep a funder or intermediary happy.",
            ],
          },
          {
            name: "Hillary Tanyanyiwa, JF Kapnek Zimbabwe",
            logo: "/logos/jf-kapnek.png",
            points: [
              "As an intermediary sub-granting to four local partners, JF Kapnek learned not to pass big-donor reporting demands down to small organisations.",
              "Keep requirements proportional to the grant size and relevant to the partner's work, and agree them together in an open discussion rather than top-down.",
              "Don't bury partners in data collection. Leave them time to analyse it, use it and share lessons back with communities.",
            ],
            quote: "Technical capacity does not equal capacity-building skill.",
          },
          {
            name: "Tapiwa Takaona, Friendship Bench",
            logo: "/logos/friendship-bench.png",
            points: [
              "Friendship Bench trains community grandmothers in problem-solving therapy for depression and anxiety. A randomised controlled trial proved the model works.",
              "An optimisation study then showed how to scale it. It now runs in 10 provinces and about 40 districts.",
              "A right-fit evidence framework keeps day-to-day monitoring to five core indicators that answer key evaluation questions.",
            ],
          },
        ],
        points: [
          "From the small groups: involve communities in evaluating their own projects, and protect people in stories by changing names or details.",
          "Track unintended impact too. One group found a crop choice had a big effect on nutrition that their numbers never captured.",
          "Collect a baseline, but keep it proportionate, and use government review meetings and joint monitoring to share data back.",
        ],
      },
      {
        id: "d2-review",
        time: "15:30",
        category: "Plenary",
        title: "Plenary review of the breakout tracks",
        lead: "Each track reported back, then partners set out what they need next.",
        points: [
          "Evidence-based impact: stop collecting data you don't use (though other funders may still ask for it), use storytelling and participatory tools for outcomes that are hard to measure, and remember that having technical skills is not the same as being able to build them in others.",
          "Alternative funding: think without the box, market yourself to the private sector, and get expert help while managing the risks.",
          "Resource mobilisation: there is no one size fits all. Invest in relationships, tap local giving, use your board's networks, make everyone a fundraiser, and don't lose your mission chasing one big grant.",
          "Asked of Oak: more peer-to-peer learning, such as quarterly online meetings, a WhatsApp group and use of the partner landscape map for introductions.",
          "Reflection questions: What will your organisation do differently in the next 90 days? Who will you follow up with, and why? What can grantees do together that none can do alone?",
        ],
        quote: { text: "Just like that acorn seed, we've been given a seed. Find your seed, plant that seed, nurture it.", by: "A grantee in the plenary review" },
      },
      {
        id: "d2-oak-qa",
        time: "16:15",
        category: "Plenary",
        title: "Oak answers partners' questions",
        speakers: [
          { name: "Karl Riber", role: "Head of Office, Oak Zimbabwe", avatar: "/api/programme/photos/day1/karl-riber-avatar.jpg" },
          { name: "Mercy", role: "Oak Zimbabwe" },
        ],
        lead: "Karl and Mercy responded to questions raised during the day.",
        points: [
          "Emergency response, including El Nino, is not part of Oak's strategy, but core grants can be adapted. Partners are encouraged to propose changes.",
          "Oak wants to hold more grant opening meetings, and plans to move the Zimbabwe programme onto its online grants platform around March next year, with online training first.",
          "Oak may turn a project application into a core grant. Core grants do not need line-by-line reporting of Oak funds.",
          "Construction is generally not funded, but there is no fixed rule against contributing to a property purchase, and vehicles can be budgeted under core support. One partner noted that duty rebates on vehicles require funds and purchase from outside Zimbabwe.",
          "Moving from project to core funding is case by case and timed to the end of the current grant. Partners renewing in 2027 should start the conversation now.",
          "Oak will help build bridges to other philanthropies and could set up quarterly peer calls hosted by different partners. Tell Oak about funders you meet.",
        ],
        quote: { text: "We've got an amazing talent pool here, there's a lot of projects, there's a lot of impact you can have here.", by: "Karl Riber, on what Oak tells other funders about Zimbabwe" },
      },
    ],
    notCovered: "Not in these notes yet: the Resource Mobilisation breakout (covered above only through its report-back) and the Gala Dinner.",
  },
  // Summarised from the Day 3 recording (11 November 2026): Oak communications, safeguarding,
  // and the closing reflections with partners' follow-up plans. Partners are named by organisation
  // where the recording does not give a clear name.
  "Day 3": {
    theme: "Letting Grantees Shine",
    intro: "The final morning covered how Oak talks about its partners' work and keeps children safe, then turned to the way forward. Partners named the organisations they plan to work with after the convening, and Oak set out how it will keep the conversation going until the next one.",
    stats: [
      { value: "26", label: "Zimbabwe partners completed the safeguarding self-assessment" },
      { value: "19", label: "Partners supported on safeguarding" },
      { value: "2", label: "Safeguarding basics every partner needs" },
      { value: "13", label: "Partners shared follow-up plans" },
    ],
    sessions: [
      {
        id: "d3-comms",
        time: "08:45",
        category: "Plenary",
        title: "Oak's approach to communications",
        speakers: [{ name: "Cheryl Chang", role: "Chief of Staff, Oak Foundation", avatar: "/api/programme/photos/day1/cheryl-chang-avatar.jpg" }],
        lead: "Cheryl explained how Oak communicates, where partner stories can appear, and Oak's branding and media guidelines, which will matter more as the Zimbabwe programme adopts Oak's global systems.",
        points: [
          "Oak's style: amplify grantees' voices, show impact on systems and communities, focus on people's aspirations and strengths, share lessons and solutions, respect all voices and stay nonpartisan.",
          "Use asset-based language. Instead of \"at-risk youth\" or \"poor neighbourhoods\", talk about young entrepreneurs and artists or community initiatives; \"local farmers building a resilient food network\" rather than \"a region suffering from hunger\".",
          "Partner stories can appear on Oak's website and video library (Oak is happy to share partners' own videos), the annual report, the newsletter and Oak's social media.",
          "Oak prefers to stay in the background. You do not need to acknowledge Oak as a funder, and you may list your grant in financial statements and reports to regulators.",
          "Any other use of Oak's name or logo, including naming Oak staff or trustees, needs written approval from Oak's communications team first. Sub-grantees can reference Oak only with that approval. The guidelines are on Oak's website, and Karl and Mercy will share them, especially at grant renewal.",
          "Getting it right: a short line saying the work was supported by Oak Foundation (not \"the Oak Foundation\"), with no long paragraph about Oak, and the logo, if approved, no bigger than other funders' logos. Oak's logo alone or most prominent can suggest Oak co-wrote or directed the work.",
          "In Q&A: keep using the convening banners already made for now; tagging Oak on social media is fine; the logo in annual reports is fine alongside all your donors' logos, with approval. The comms team replies quickly.",
          "Want help developing or amplifying a story? Add your name to the postcard on the Oak table and the team will follow up.",
        ],
        quote: { text: "Your work and impact are really the heart of our communications.", by: "Cheryl Chang" },
      },
      {
        id: "d3-safeguarding",
        time: "09:30",
        category: "Plenary",
        title: "Safeguarding at Oak",
        speakers: [{ name: "Alice Gentile", role: "Adviser for Organisational Development, Oak Foundation" }],
        lead: "Alice explained how Oak approaches child safeguarding, its new self-assessment form, and the support partners can get.",
        stats: [
          { value: "11", label: "Risk screening questions" },
          { value: "2", label: "Core measures for all partners" },
          { value: "3 yrs", label: "Self-assessment valid for" },
          { value: "17", label: "Zimbabwe partners asked for support" },
        ],
        points: [
          "Oak's definition: making sure staff, programmes, partners and operations do no harm to children and do not expose them to the risk of harm or abuse. Oak focuses on child safeguarding, in line with its programme on preventing child sexual abuse.",
          "Safeguarding is not one person's job. It covers how people behave and how activities are designed, prevention, attention to power and trust, and clear systems and accountability, and it touches recruitment, IT, safety and security.",
          "It is a shared responsibility: Oak staff follow Oak's policy and code of conduct, partners know their context and risks, and measures are agreed together and kept proportionate to each organisation's risk.",
          "The revised self-assessment, launched last month, starts with 11 risk screening questions: contact with children, crisis settings, other vulnerable groups, sub-granting, research, and use of children's images and data.",
          "Only two measures are required of everyone: a safeguarding lead, and clear reporting and response procedures. An existing general reporting channel counts. The assessment lasts three years unless your work changes significantly.",
          "Risk ratings only show exposure (in Zimbabwe: 1 low, 6 medium, 19 high). A high-risk organisation can still have excellent safeguards. Partners are grouped as standards met, partially met, or foundations to establish.",
          "Safeguarding is the only area of organisational strengthening that Oak can require. Common requests: safe communications (children's images, data and consent), policy review, data protection, online and AI-related risks, reporting channels people actually use, training, and putting policy into practice.",
          "Support comes through grants, the NonProfit Builder platform (partners choose an expert and rate them, and Oak stays out of the discussions), small OD grants and specialist partners. Oak is also exploring partner-to-partner support.",
          "Intermediaries need their own safeguards, clear and proportionate expectations for sub-grantees, and a documented process for responding to incidents.",
          "In Q&A: one comprehensive policy that is easy to understand and actually used beats many separate ones. Child safeguarding is the organisation's own responsibility; child protection is wider and includes the state. If consultant support stalls, tell Mercy, Karl or Alice so they can follow up.",
        ],
        quote: { text: "An organisation shouldn't be burdened with a trillion policies, because then you have to manage the policies.", by: "Alice Gentile" },
      },
      {
        id: "d3-connections",
        time: "10:15",
        category: "Networking",
        title: "Connections partners will take forward",
        lead: "Asked which connection from the three days they will follow up on, partners named specific organisations and plans.",
        points: [
          "Caritas Chinhoyi wants the Adult Rape Clinic's mental health and psychosocial support expertise for the rural one-stop centre for survivors it is building.",
          "ZIMCARE Trust plans eye screening for its Bulawayo learners with Council for the Blind, to learn production and markets from Jafuta Foundation, and to learn fundraising from KidzCan and Bethany Project.",
          "Mashambanzou Care Trust, entering a new strategy and more independence, will invite Bethany Project to share how it engaged its board, and wants to learn from Island Hospice on social enterprise.",
          "Simukai will follow Friendship Bench's lead on qualitative evidence, with stakeholders involved in gathering it.",
          "SAT is adding coding and programming courses from January 2027 and wants to work with Uncommon. APT wants Uncommon to build skills for teachers and learners at a rural school it connected to the internet, and to connect with St Albert's Mission near Mount Darwin.",
          "Young Africa reconnected with Rafiki Girls Centre and met Tikobane. Another partner met SAT to sell its chillies, and one hopes to reach young children through Mavambo's network of 198 primary schools.",
          "Several partners discovered Uncommon trains young people in tech, not just running events. Uncommon invited partners to offer internships and vacancies to its graduates.",
        ],
      },
      {
        id: "d3-way-forward",
        time: "10:15",
        category: "Plenary",
        title: "Reflections and the way forward",
        speakers: [{ name: "Karl Riber", role: "Head of Office, Oak Zimbabwe", avatar: "/api/programme/photos/day1/karl-riber-avatar.jpg" }],
        lead: "Karl looked back at what the convening set out to do and what Oak will do next.",
        points: [
          "The goals were stronger relationships between Oak (Geneva and Zimbabwe) and partners, a deeper understanding of Oak, and a focus on sustainability and resource mobilisation. Speed networking and the breakouts drew more engagement than expected.",
          "Thanks to the partners who openly shared how they built social enterprises, and a reminder that evidence helps both fundraising and better programming.",
          "To keep momentum between convenings, Oak will set up quarterly or informal calls, possibly by region (such as Victoria Falls, Harare and Mutare), with partners who want to help lead them.",
          "Oak Zimbabwe will follow up the 1:1s with Silvia and Alice, link partners to organisational development support and to experts among the partners, and build relationships with funders who cover what Oak doesn't, such as infrastructure.",
          "Oak will make expectations clearer for intermediaries and sub-grantees, hold grant opening meetings more systematically, and move Zimbabwe grantees onto Oak's online grant management system.",
          "Tell Oak about other philanthropies you work with, so it can help build bridges.",
          "Please complete the anonymous feedback form, on the portal or on paper.",
        ],
        quote: { text: "Just having somebody outside our organisation ask us clarifying questions can be quite affirming and help to energise us.", by: "Karl Riber" },
      },
    ],
    notCovered: "Not in these notes: the opening minutes of the communications session (the recording starts partway through) and the group photograph.",
  },
};

const CATEGORY_STYLES: Record<Category, { chip: string; bar: string }> = {
  Plenary: { chip: "bg-[#E8EEF9] text-[#1C2C4F]", bar: "from-[#162E55] to-[#3B5A8C]" },
  Showcase: { chip: "bg-[#FDF1E3] text-[#8A4B0F]", bar: "from-[#C97A2B] to-[#E9A65A]" },
  Networking: { chip: "bg-[#E6F4EE] text-[#1F5E43]", bar: "from-[#2F7A57] to-[#5BAE86]" },
  Panel: { chip: "bg-[#F0EAFB] text-[#4B2A85]", bar: "from-[#5B3A9B] to-[#9A7BD1]" },
  Breakout: { chip: "bg-[#E3F4F5] text-[#155E63]", bar: "from-[#1F7A80] to-[#58B4B9]" },
};

const COLLAPSED_POINTS = 3;

function SpeakerChip({ speaker, person }: { speaker: RecapSpeaker; person: PersonSummary | null }) {
  const body = (
    <>
      <PersonAvatar name={person?.full_name ?? speaker.name} photoUrl={speaker.avatar ?? person?.photo_url} size="md" className="ring-2 ring-white shadow-sm" />
      <span className="min-w-0">
        <span className="block text-[14px] font-bold leading-tight text-slate-900">{speaker.name}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{speaker.role}</span>
      </span>
    </>
  );
  if (!person) return <div className="flex items-center gap-3">{body}</div>;
  return (
    <Link href={`/speakers/${person.slug}`} className="group flex items-center gap-3 rounded-2xl -m-1.5 p-1.5 transition hover:bg-slate-50">
      {body}
    </Link>
  );
}

function RecapCard({ session, match }: { session: SessionRecap; match: (name: string) => PersonSummary | null }) {
  const [open, setOpen] = useState(false);
  const style = CATEGORY_STYLES[session.category];
  const points = session.points ?? [];
  const canExpand = points.length > COLLAPSED_POINTS;
  const visible = open || !canExpand ? points : points.slice(0, COLLAPSED_POINTS);

  return (
    <article className={`relative flex h-full flex-col overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] ${session.orgs ? "md:col-span-2" : ""}`}>
      {session.photo ? (
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-slate-900">
          <img src={session.photo.src} alt={session.photo.alt} loading="lazy" style={{ objectPosition: session.photo.position ?? "50% 50%" }} className="h-full w-full object-cover" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
          <div className="absolute bottom-3 left-4 right-4 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${style.chip}`}>{session.category}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
              <Clock aria-hidden className="h-3 w-3" /> {session.time}
            </span>
          </div>
        </div>
      ) : (
        <div aria-hidden className={`h-1.5 w-full shrink-0 bg-gradient-to-r ${style.bar}`} />
      )}
      <div className="flex flex-1 flex-col p-5 md:p-6">
        {!session.photo && (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${style.chip}`}>{session.category}</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
              <Clock aria-hidden className="h-3 w-3" /> {session.time}
            </span>
          </div>
        )}
        <h3 className="text-[18px] font-bold leading-snug text-[#0E1726]">{session.title}</h3>

        {session.speakers && (
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
            {session.speakers.map(speaker => <SpeakerChip key={speaker.name} speaker={speaker} person={match(speaker.name)} />)}
          </div>
        )}

        <p className="mt-4 text-[14px] leading-[1.65] text-slate-600">{session.lead}</p>

        {session.stats && (
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-flow-col sm:auto-cols-fr sm:grid-cols-none">
            {session.stats.map(stat => (
              <div key={stat.label} className="rounded-2xl bg-[#F4F6FB] px-3 py-3">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-[18px] font-bold leading-none text-[#162E55]">{stat.value}</dd>
                <dd className="mt-1.5 text-[11px] font-medium leading-tight text-slate-500">{stat.label}</dd>
              </div>
            ))}
          </dl>
        )}

        {session.orgs && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {session.orgs.map(org => (
              <div key={org.name} className="flex flex-col rounded-2xl border border-slate-100 bg-[#FAFBFD] p-4">
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-1.5">
                    <img src={org.logo} alt="" className="max-h-full max-w-full object-contain" />
                  </span>
                  <h4 className="text-[14px] font-bold text-slate-900">{org.name}</h4>
                </div>
                <ul className="space-y-2">
                  {org.points.map(point => (
                    <li key={point} className="flex gap-2.5 text-[13px] leading-[1.6] text-slate-700">
                      <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#C97A2B]" />
                      {point}
                    </li>
                  ))}
                </ul>
                {org.quote && (
                  <p className="mt-3 border-l-2 border-[#E9A65A] pl-3 text-[13px] italic leading-[1.6] text-slate-600">&ldquo;{org.quote}&rdquo;</p>
                )}
              </div>
            ))}
          </div>
        )}

        {visible.length > 0 && (
          <ul className="mt-4 space-y-2.5">
            {visible.map(point => (
              <li key={point} className="flex gap-3 text-[14px] leading-[1.65] text-slate-700">
                <span aria-hidden className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#425780]" />
                {point}
              </li>
            ))}
          </ul>
        )}
        {canExpand && (
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="mt-3 inline-flex items-center gap-1 text-[12px] font-bold text-[#162E55] hover:underline">
            {open ? "Show less" : `Show ${points.length - COLLAPSED_POINTS} more`}
            <ChevronDown aria-hidden className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}

        {session.quote && (
          <figure className="mt-5 rounded-2xl bg-gradient-to-br from-[#F4F6FB] to-[#EAEFF8] p-4 md:p-5">
            <Quote aria-hidden className="mb-2 h-5 w-5 text-[#93A5CE]" />
            <blockquote className="text-[15px] font-medium leading-[1.6] text-[#1C2C4F]">&ldquo;{session.quote.text}&rdquo;</blockquote>
            <figcaption className="mt-2 text-[12px] font-semibold text-slate-500">{session.quote.by}</figcaption>
          </figure>
        )}
      </div>
    </article>
  );
}

/** Link to the shared photo folder for a day, if one has been added. */
export function photosUrlFor(dayLabel: string) {
  return RECAPS[dayLabel]?.photosUrl;
}

export function SessionRecaps({ dayLabel, match }: { dayLabel: string; match: (name: string) => PersonSummary | null }) {
  const recap = RECAPS[dayLabel];
  if (!recap) {
    return (
      <section className="rounded-[24px] border border-dashed border-slate-200 bg-white/70 p-6 text-center">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#6B7590]">
          <Sparkles aria-hidden className="h-3.5 w-3.5" /> {dayLabel} recap
        </p>
        <p className="mt-2 text-[14px] text-slate-600">The {dayLabel} summary, speaker notes and photos will be added here after the sessions.</p>
      </section>
    );
  }

  const speakers = recap.sessions.flatMap(session => session.speakers ?? []);

  return (
    <section className="space-y-4">
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0E1C36] via-[#162E55] to-[#2C4A7C] p-6 text-white md:p-8">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/5" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-white/5" />
        <p className="relative inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#93A5CE]">
          <Sparkles aria-hidden className="h-3.5 w-3.5" /> {dayLabel} recap
        </p>
        <h2 className="relative mt-2 text-[24px] font-bold leading-tight md:text-[28px]">{recap.theme}</h2>
        <p className="relative mt-3 max-w-2xl text-[14px] leading-[1.65] text-white/80">{recap.intro}</p>
        {recap.photosUrl && (
          <a
            href={recap.photosUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="relative mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-bold text-[#162E55] shadow-sm transition hover:bg-[#E8EEF9]"
          >
            <Images aria-hidden className="h-4 w-4" />
            View all {dayLabel} photos
            <span className="sr-only">(opens Google Drive in a new tab)</span>
          </a>
        )}

        <div className="relative mt-5 flex items-center">
          <div className="flex -space-x-2.5">
            {speakers.map(speaker => {
              const person = match(speaker.name);
              return <PersonAvatar key={speaker.name} name={person?.full_name ?? speaker.name} photoUrl={speaker.avatar ?? person?.photo_url} size="sm" className="ring-2 ring-[#162E55]" />;
            })}
          </div>
          <p className="ml-3 text-[12px] text-white/70">{speakers.map(s => s.name).join(", ")}</p>
        </div>

        <dl className="relative mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {recap.stats.map(stat => (
            <div key={stat.label} className="rounded-2xl bg-white/10 px-3.5 py-3 backdrop-blur-sm">
              <dt className="sr-only">{stat.label}</dt>
              <dd className="text-[22px] font-bold leading-none">{stat.value}</dd>
              <dd className="mt-1.5 text-[11px] font-medium leading-tight text-white/70">{stat.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-2">
        {recap.sessions.map(session => <RecapCard key={session.id} session={session} match={match} />)}
      </div>
      {recap.notCovered && (
        <p className="rounded-[18px] border border-dashed border-slate-200 bg-white/70 px-5 py-3.5 text-[12px] leading-[1.6] text-slate-500">
          {recap.notCovered}
        </p>
      )}
    </section>
  );
}
