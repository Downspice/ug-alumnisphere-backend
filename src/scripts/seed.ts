import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import { User } from "../models/User.js";
import { Connection, connectionPairKey } from "../models/Connection.js";
import { Community } from "../models/Community.js";
import { CommunityMember } from "../models/CommunityMember.js";
import { CommunityJoinRequest } from "../models/CommunityJoinRequest.js";
import { Conversation, conversationPairKey } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { Post } from "../models/Post.js";
import { Comment } from "../models/Comment.js";
import { PostLike } from "../models/PostLike.js";
import { SavedPost } from "../models/SavedPost.js";
import { PollVote } from "../models/PollVote.js";
import { Job } from "../models/Job.js";
import { JobApplication } from "../models/JobApplication.js";
import { SavedJob } from "../models/SavedJob.js";
import { MentorshipRequest, mentorshipPairKey } from "../models/MentorshipRequest.js";
import { Mentorship } from "../models/Mentorship.js";
import { Event } from "../models/Event.js";
import { EventRegistration } from "../models/EventRegistration.js";
import { Campaign } from "../models/Campaign.js";
import { Contribution } from "../models/Contribution.js";
import { Notification } from "../models/Notification.js";
import { Report } from "../models/Report.js";
import { VerificationRequest } from "../models/VerificationRequest.js";
import { StoredFile } from "../models/StoredFile.js";
import { Exam } from "../models/Exam.js";
import { hashPassword } from "../utils/auth.js";

dotenv.config();

const DEMO_PASSWORD = "AlumniSphere#2026";

const wiki = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=1600`;

const IMAGES = {
  greatHall: wiki("Great hall university of Ghana.jpg"),
  balme: wiki("University of Ghana Balme Library.jpg"),
  tower: wiki("Great Hall Tower.jpg"),
  mixer:
    "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80",
  workshop:
    "https://images.unsplash.com/photo-1524178232363-1fb2b075b955?auto=format&fit=crop&w=1400&q=80",
  graduation:
    "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1400&q=80",
  library:
    "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1400&q=80",
  coding:
    "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1400&q=80",
  reunion:
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=80",
  students:
    "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1400&q=80",
  lecture:
    "https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?auto=format&fit=crop&w=1400&q=80",
  campus:
    "https://images.unsplash.com/photo-1541339902988-6cc4e0c74ea2?auto=format&fit=crop&w=1400&q=80",
};

const portrait = (kind: "men" | "women", id: number) =>
  `https://randomuser.me/api/portraits/${kind}/${id}.jpg`;

const accounts = [
  {
    name: "AlumniSphere Administrator",
    email: "admin@alumnisphere.ug",
    role: "admin" as const,
    headline: "University of Ghana · Platform Administrator",
    about: "Keeps the Legon network in order — verification, events, and giving records.",
    location: "Legon, Accra",
    verificationStatus: "verified" as const,
    avatarUrl: portrait("men", 11),
  },
  {
    name: "Ama Boateng",
    email: "alumni.demo@alumnisphere.ug",
    role: "alumni" as const,
    headline: "Software Engineer · Class of 2018",
    about:
      "CS alum building campus products. Happy to review intern CVs and talk TypeScript, GraphQL, and first jobs in Accra.",
    graduationYear: 2018,
    programme: "Computer Science",
    department: "Computer Science",
    faculty: "Physical and Mathematical Sciences",
    industry: "Technology",
    company: "University of Ghana",
    jobTitle: "Software Engineer",
    location: "Accra, Ghana",
    skills: ["TypeScript", "Product Design", "Mentorship"],
    openToMentor: true,
    verificationStatus: "verified" as const,
    avatarUrl: portrait("women", 65),
  },
  {
    name: "Kwame Mensah",
    email: "student.demo@alumnisphere.ug",
    role: "student" as const,
    headline: "Final-year Computer Science student",
    about:
      "Looking for internships and a mentor who has already walked the Legon-to-industry path. Open to research and product engineering.",
    programme: "Computer Science",
    department: "Computer Science",
    location: "Legon, Accra",
    skills: ["Python", "Research"],
    openToWork: true,
    verificationStatus: "unverified" as const,
    avatarUrl: portrait("men", 32),
  },
  {
    name: "Efua Asante",
    email: "efua.asante@alumnisphere.ug",
    role: "alumni" as const,
    headline: "Product Manager · Class of 2016",
    about:
      "Information Studies alum at MTN Ghana. I host product clinics for students who want to move from campus projects into shipping.",
    graduationYear: 2016,
    programme: "Information Studies",
    department: "Information Studies",
    industry: "Technology",
    company: "MTN Ghana",
    jobTitle: "Product Manager",
    location: "Accra, Ghana",
    skills: ["Product", "Research", "Mentorship"],
    openToMentor: true,
    verificationStatus: "verified" as const,
    avatarUrl: portrait("women", 44),
  },
  {
    name: "Yaw Owusu",
    email: "yaw.owusu@alumnisphere.ug",
    role: "alumni" as const,
    headline: "Civil Engineer · Class of 2014",
    about:
      "Infrastructure alum at Ghana Highways Authority. Mentoring students who want site experience and public-works internships.",
    graduationYear: 2014,
    programme: "Civil Engineering",
    department: "Civil Engineering",
    industry: "Infrastructure",
    company: "Ghana Highways Authority",
    jobTitle: "Project Engineer",
    location: "Kumasi, Ghana",
    skills: ["Infrastructure", "Project Management"],
    openToMentor: true,
    verificationStatus: "verified" as const,
    avatarUrl: portrait("men", 75),
  },
  {
    name: "Abena Sarpong",
    email: "abena.sarpong@alumnisphere.ug",
    role: "alumni" as const,
    headline: "Physician · Class of 2012",
    about:
      "College of Health Sciences alum. Open to mentoring students considering medicine and public health.",
    graduationYear: 2012,
    programme: "Medicine",
    department: "Medicine",
    faculty: "Health Sciences",
    industry: "Healthcare",
    company: "Korle Bu Teaching Hospital",
    jobTitle: "Physician",
    location: "Accra, Ghana",
    skills: ["Clinical Care", "Mentorship"],
    openToMentor: true,
    verificationStatus: "verified" as const,
    avatarUrl: portrait("women", 21),
  },
  {
    name: "Kojo Addo",
    email: "kojo.addo@alumnisphere.ug",
    role: "alumni" as const,
    headline: "Counsel · Class of 2015",
    about:
      "Law alum in Accra. Happy to talk pupillage, chambers, and public-interest work.",
    graduationYear: 2015,
    programme: "Law",
    department: "Law",
    faculty: "Humanities",
    industry: "Legal",
    company: "Accra Legal Chambers",
    jobTitle: "Counsel",
    location: "Accra, Ghana",
    skills: ["Law", "Advocacy"],
    openToMentor: true,
    verificationStatus: "verified" as const,
    avatarUrl: portrait("men", 52),
  },
  {
    name: "Akosua Darko",
    email: "akosua.darko@alumnisphere.ug",
    role: "student" as const,
    headline: "Economics student · Legon",
    about: "Third-year student looking for alumni in policy, research, and data.",
    programme: "Economics",
    department: "Economics",
    location: "Legon, Accra",
    skills: ["Econometrics", "Writing"],
    openToWork: true,
    verificationStatus: "unverified" as const,
    avatarUrl: portrait("women", 33),
  },
  {
    name: "Nana Yeboah",
    email: "nana.yeboah@alumnisphere.ug",
    role: "alumni" as const,
    headline: "Brand lead · Class of 2017",
    about:
      "Business School alum. Open to mentoring students who want marketing internships in Accra.",
    graduationYear: 2017,
    programme: "Business Administration",
    department: "Marketing",
    faculty: "Humanities",
    industry: "Marketing",
    company: "Unilever Ghana",
    jobTitle: "Brand Lead",
    location: "Tema, Ghana",
    skills: ["Brand", "Mentorship"],
    openToMentor: true,
    openToWork: false,
    verificationStatus: "verified" as const,
    avatarUrl: portrait("women", 68),
  },
];

async function resetCollections() {
  await Promise.all([
    User.deleteMany({}),
    Connection.deleteMany({}),
    Community.deleteMany({}),
    CommunityMember.deleteMany({}),
    CommunityJoinRequest.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Post.deleteMany({}),
    Comment.deleteMany({}),
    PostLike.deleteMany({}),
    SavedPost.deleteMany({}),
    PollVote.deleteMany({}),
    Job.deleteMany({}),
    JobApplication.deleteMany({}),
    SavedJob.deleteMany({}),
    MentorshipRequest.deleteMany({}),
    Mentorship.deleteMany({}),
    Event.deleteMany({}),
    EventRegistration.deleteMany({}),
    Campaign.deleteMany({}),
    Contribution.deleteMany({}),
    Notification.deleteMany({}),
    Report.deleteMany({}),
    VerificationRequest.deleteMany({}),
    StoredFile.deleteMany({}),
    Exam.deleteMany({}),
  ]);
  console.log("[seed] Cleared existing collections");
}

async function seed() {
  await connectDB();
  await resetCollections();

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const created = await User.insertMany(
    accounts.map((account) => ({
      ...account,
      passwordHash,
      accountStatus: "active" as const,
      skills: "skills" in account ? account.skills : [],
      openToWork: "openToWork" in account ? Boolean(account.openToWork) : false,
      openToMentor: "openToMentor" in account ? Boolean(account.openToMentor) : false,
    }))
  );
  const byEmail = Object.fromEntries(created.map((user) => [user.email, user]));
  const admin = byEmail["admin@alumnisphere.ug"];
  const ama = byEmail["alumni.demo@alumnisphere.ug"];
  const kwame = byEmail["student.demo@alumnisphere.ug"];
  const efua = byEmail["efua.asante@alumnisphere.ug"];
  const yaw = byEmail["yaw.owusu@alumnisphere.ug"];
  const abena = byEmail["abena.sarpong@alumnisphere.ug"];
  const kojo = byEmail["kojo.addo@alumnisphere.ug"];
  const akosua = byEmail["akosua.darko@alumnisphere.ug"];
  const nana = byEmail["nana.yeboah@alumnisphere.ug"];
  console.log(`[seed] Created ${created.length} people with portraits`);

  const pairs = [
    [ama, efua],
    [ama, yaw],
    [ama, kwame],
    [ama, abena],
    [ama, nana],
    [efua, kwame],
    [efua, nana],
    [yaw, kwame],
    [abena, akosua],
    [kojo, ama],
  ] as const;
  for (const [requester, addressee] of pairs) {
    const pairKey = connectionPairKey(requester._id.toString(), addressee._id.toString());
    await Connection.create({
      requesterId: requester._id,
      addresseeId: addressee._id,
      pairKey,
      status: "accepted",
    });
  }
  console.log("[seed] Accepted demo connections");

  const publicCommunity = await Community.create({
    name: "Computer Science Alumni",
    slug: "computer-science-alumni",
    description: "Public space for CS alumni, students, and mentors from Legon.",
    isPrivate: false,
    ownerId: ama._id,
    memberCount: 4,
    coverImageUrl: IMAGES.coding,
  });
  const privateCommunity = await Community.create({
    name: "Class of 2018",
    slug: "class-of-2018",
    description: "Private community for the 2018 graduating class.",
    isPrivate: true,
    ownerId: ama._id,
    memberCount: 3,
    coverImageUrl: IMAGES.reunion,
  });
  const mentorsCommunity = await Community.create({
    name: "Legon Mentors",
    slug: "legon-mentors",
    description: "Alumni who are open to structured mentorship across colleges.",
    isPrivate: false,
    ownerId: efua._id,
    memberCount: 4,
    coverImageUrl: IMAGES.students,
  });

  const memberships = [
    [publicCommunity, ama, "owner"],
    [publicCommunity, efua, "moderator"],
    [publicCommunity, kwame, "member"],
    [publicCommunity, nana, "member"],
    [privateCommunity, ama, "owner"],
    [privateCommunity, yaw, "member"],
    [privateCommunity, nana, "member"],
    [mentorsCommunity, efua, "owner"],
    [mentorsCommunity, ama, "moderator"],
    [mentorsCommunity, abena, "member"],
    [mentorsCommunity, yaw, "member"],
  ] as const;
  for (const [community, user, role] of memberships) {
    await CommunityMember.create({
      communityId: community._id,
      userId: user._id,
      role,
    });
  }
  console.log("[seed] Demo communities with covers");

  const welcome = await Post.create({
    authorId: ama._id,
    type: "text",
    body: "Welcome to the AlumniSphere feed. Share campus photos, links, and polls with the Legon network.",
    likeCount: 8,
    commentCount: 2,
  });
  await Post.create({
    authorId: ama._id,
    type: "image",
    body: "Dusk over the Great Hall. Integri Procedamus — who is coming back for homecoming?",
    imageUrl: IMAGES.greatHall,
    likeCount: 21,
  });
  await Post.create({
    authorId: kwame._id,
    type: "image",
    body: "Reading week at Balme. If any CS alum is on campus this Friday, I owe you a coffee.",
    imageUrl: IMAGES.balme,
    likeCount: 11,
  });
  await Post.create({
    authorId: efua._id,
    type: "image",
    body: "Product clinic photos from last month's alumni mixer in Accra.",
    imageUrl: IMAGES.mixer,
    likeCount: 14,
  });
  await Post.create({
    authorId: nana._id,
    type: "image",
    body: "Convocation still hits. Class of 2017, drop where you are practising now.",
    imageUrl: IMAGES.graduation,
    likeCount: 19,
  });
  await Post.create({
    authorId: efua._id,
    type: "link",
    body: "A useful starting point for alumni building in Ghana.",
    linkUrl: "https://www.ug.edu.gh",
    likeCount: 6,
  });
  await Post.create({
    authorId: ama._id,
    type: "poll",
    body: "Help us plan the next alumni clinic.",
    pollQuestion: "Which session should we run first?",
    pollOptions: [
      { text: "Mentorship office hours", voteCount: 12 },
      { text: "Job-search clinic", voteCount: 9 },
      { text: "Startup office hours", voteCount: 4 },
    ],
    likeCount: 7,
  });
  await Post.create({
    authorId: ama._id,
    communityId: publicCommunity._id,
    type: "image",
    body: "CS alumni: drop your current stack. This is from a late lab session that still feels like home.",
    imageUrl: IMAGES.coding,
    likeCount: 16,
  });
  await Comment.create({
    postId: welcome._id,
    authorId: kwame._id,
    body: "Signed in from Commonwealth Hall. The portraits already make this feel like campus.",
  });
  await Comment.create({
    postId: welcome._id,
    authorId: efua._id,
    body: "Clinic dates going up on Events this week.",
  });
  console.log("[seed] Demo posts with campus and event photos");

  const pairKey = conversationPairKey(ama._id.toString(), efua._id.toString());
  const conversation = await Conversation.create({
    pairKey,
    participantIds: [ama._id, efua._id],
    lastMessagePreview: "I will bring the Great Hall photos for the event page.",
    lastMessageAt: new Date(),
    unread: { [ama._id.toString()]: 0, [efua._id.toString()]: 1 },
  });
  await Message.create({
    conversationId: conversation._id,
    senderId: efua._id,
    body: "Shall we host a product clinic next month at the Great Hall foyer?",
  });
  await Message.create({
    conversationId: conversation._id,
    senderId: ama._id,
    body: "Yes — I will bring the Great Hall photos for the event page.",
  });
  const amaKwameChatKey = conversationPairKey(ama._id.toString(), kwame._id.toString());
  const amaKwameChat = await Conversation.create({
    pairKey: amaKwameChatKey,
    participantIds: [ama._id, kwame._id],
    lastMessagePreview: "Send the CV tonight and I will mark it up.",
    lastMessageAt: new Date(),
    unread: { [ama._id.toString()]: 0, [kwame._id.toString()]: 0 },
  });
  await Message.create({
    conversationId: amaKwameChat._id,
    senderId: kwame._id,
    body: "Ama, could you look at my internship CV before Friday?",
  });
  await Message.create({
    conversationId: amaKwameChat._id,
    senderId: ama._id,
    body: "Send the CV tonight and I will mark it up.",
  });
  console.log("[seed] Demo conversations");

  const softwareJob = await Job.create({
    title: "Software Engineer, Alumni Products",
    company: "University of Ghana",
    location: "Accra, Ghana",
    type: "full_time",
    industry: "Technology",
    description:
      "Build AlumniSphere features with TypeScript and GraphQL. You will work with alumni mentors and student contributors.",
    requirements: "TypeScript, MongoDB, and an interest in campus products.",
    postedById: ama._id,
    status: "open",
  });
  await Job.create({
    title: "Product intern, alumni programmes",
    company: "MTN Ghana",
    location: "Accra, Ghana",
    type: "internship",
    industry: "Technology",
    description:
      "Support alumni product discovery interviews and write research notes for the next campus clinic.",
    requirements: "Clear writing and curiosity about alumni networks.",
    postedById: efua._id,
    status: "open",
  });
  await JobApplication.create({
    jobId: softwareJob._id,
    applicantId: kwame._id,
    coverNote:
      "I am a final-year CS student looking for a product engineering internship-to-hire path at UG.",
    status: "submitted",
  });
  console.log("[seed] Demo jobs");

  const amaKwameKey = mentorshipPairKey(ama._id.toString(), kwame._id.toString());
  await Mentorship.create({
    mentorId: ama._id,
    menteeId: kwame._id,
    pairKey: amaKwameKey,
    status: "active",
    goals: [{ text: "Review Kwame's CV and internship applications", done: false }],
  });
  await MentorshipRequest.create({
    menteeId: kwame._id,
    mentorId: ama._id,
    pairKey: amaKwameKey,
    message: "I would like monthly feedback on internships and a first engineering role.",
    status: "accepted",
  });
  await MentorshipRequest.create({
    menteeId: kwame._id,
    mentorId: yaw._id,
    pairKey: mentorshipPairKey(yaw._id.toString(), kwame._id.toString()),
    message:
      "I want advice on moving from campus projects into infrastructure internships.",
    status: "pending",
  });
  console.log("[seed] Demo mentorship");

  const mixer = await Event.create({
    title: "Accra alumni mixer",
    description:
      "An evening for UG alumni and final-year students to meet mentors, hiring managers, and classmates.",
    location: "Accra, Ghana",
    startsAt: new Date("2026-09-12T18:00:00.000Z"),
    endsAt: new Date("2026-09-12T21:00:00.000Z"),
    capacity: 80,
    status: "published",
    createdById: admin._id,
    coverImageUrl: IMAGES.mixer,
  });
  await Event.create({
    title: "Career clinic at Balme",
    description:
      "Small-group CV and interview practice in the Balme Library seminar rooms. Facilitators confirmed.",
    location: "Balme Library, Legon",
    startsAt: new Date("2026-10-04T10:00:00.000Z"),
    endsAt: new Date("2026-10-04T13:00:00.000Z"),
    capacity: 24,
    status: "published",
    createdById: admin._id,
    coverImageUrl: IMAGES.workshop,
  });
  await Event.create({
    title: "Homecoming lecture · Great Hall",
    description:
      "Integri Procedamus. A public lecture for alumni returning to Legon, followed by portraits on the Great Hall steps.",
    location: "Great Hall, University of Ghana",
    startsAt: new Date("2026-11-08T15:00:00.000Z"),
    endsAt: new Date("2026-11-08T18:00:00.000Z"),
    capacity: 400,
    status: "published",
    createdById: admin._id,
    coverImageUrl: IMAGES.greatHall,
  });
  await Event.create({
    title: "Career clinic (draft)",
    description: "Small-group CV practice. Publish when facilitators are confirmed.",
    location: "Legon, Accra",
    startsAt: new Date("2026-10-18T10:00:00.000Z"),
    capacity: 24,
    status: "draft",
    createdById: admin._id,
    coverImageUrl: IMAGES.lecture,
  });
  await Event.create({
    title: "Kumasi cancelled mixer",
    description: "Postponed due to venue unavailability. Kept as a cancelled record.",
    location: "Kumasi, Ghana",
    startsAt: new Date("2026-08-20T18:00:00.000Z"),
    status: "cancelled",
    createdById: admin._id,
    coverImageUrl: IMAGES.reunion,
  });
  await EventRegistration.create({ eventId: mixer._id, userId: kwame._id });
  await EventRegistration.create({ eventId: mixer._id, userId: ama._id });
  console.log("[seed] Demo events with covers");

  const scholarship = await Campaign.create({
    title: "CS scholarship fund",
    description:
      "Support need-based scholarships for Computer Science students at the University of Ghana. Records only — no card payment is taken.",
    goalAmount: 50000,
    deadline: new Date("2026-12-31T23:59:59.000Z"),
    status: "active",
    createdById: admin._id,
    coverImageUrl: IMAGES.graduation,
  });
  await Campaign.create({
    title: "Balme Library appeal",
    description:
      "Equip reading rooms and preserve the Balme collection. Alumni gifts are recorded against the published goal.",
    goalAmount: 20000,
    deadline: new Date("2026-11-30T23:59:59.000Z"),
    status: "active",
    createdById: admin._id,
    coverImageUrl: IMAGES.balme,
  });
  await Campaign.create({
    title: "Library draft appeal",
    description:
      "Draft campaign for additional Balme equipment. Publish when the goal is confirmed.",
    goalAmount: 12000,
    status: "draft",
    createdById: admin._id,
    coverImageUrl: IMAGES.library,
  });
  await Contribution.create({
    campaignId: scholarship._id,
    contributorId: ama._id,
    amount: 500,
    anonymous: false,
    note: "For the next CS cohort.",
    status: "recorded",
    createdAt: new Date("2026-06-15T10:00:00.000Z"),
  });
  await Contribution.create({
    campaignId: scholarship._id,
    contributorId: efua._id,
    amount: 250,
    anonymous: true,
    note: "Anonymous alumni gift.",
    status: "recorded",
    createdAt: new Date("2026-07-02T10:00:00.000Z"),
  });
  await Contribution.create({
    campaignId: scholarship._id,
    contributorId: yaw._id,
    amount: 150,
    anonymous: false,
    status: "recorded",
    createdAt: new Date("2026-08-01T10:00:00.000Z"),
  });

  await Notification.create({
    userId: kwame._id,
    title: "Welcome to AlumniSphere",
    body: "Complete your profile, then browse jobs, mentors, and giving campaigns.",
    href: "/profile",
    read: false,
  });
  await Notification.create({
    userId: ama._id,
    title: "New job application",
    body: "Kwame Mensah applied for Software Engineer, Alumni Products.",
    href: "/jobs",
    read: false,
  });
  await Notification.create({
    userId: yaw._id,
    title: "Mentorship request",
    body: "Kwame Mensah asked you to mentor them.",
    href: "/mentors",
    read: false,
  });
  await Report.create({
    reporterId: kwame._id,
    targetType: "post",
    targetId: welcome._id,
    reason: "This looks like a test post and should be reviewed for tone.",
    status: "open",
  });
  console.log("[seed] Demo campaigns, notifications, and a report");

  console.log(`[seed] Demo password for all seeded accounts: ${DEMO_PASSWORD}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("[seed] Failed:", error);
  process.exit(1);
});
