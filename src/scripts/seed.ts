import dotenv from "dotenv";
import { connectDB } from "../config/db.js";
import { User } from "../models/User.js";
import { Connection, connectionPairKey } from "../models/Connection.js";
import { Community } from "../models/Community.js";
import { CommunityMember } from "../models/CommunityMember.js";
import { Conversation, conversationPairKey } from "../models/Conversation.js";
import { Message } from "../models/Message.js";
import { Post } from "../models/Post.js";
import { Job } from "../models/Job.js";
import { JobApplication } from "../models/JobApplication.js";
import { MentorshipRequest, mentorshipPairKey } from "../models/MentorshipRequest.js";
import { Mentorship } from "../models/Mentorship.js";
import { Event } from "../models/Event.js";
import { EventRegistration } from "../models/EventRegistration.js";
import { Campaign } from "../models/Campaign.js";
import { Contribution } from "../models/Contribution.js";
import { Notification } from "../models/Notification.js";
import { Report } from "../models/Report.js";
import { hashPassword } from "../utils/auth.js";

dotenv.config();

const DEMO_PASSWORD = "AlumniSphere#2026";

const accounts = [
  {
    name: "AlumniSphere Administrator",
    email: "admin@alumnisphere.ug",
    role: "admin" as const,
    headline: "University of Ghana · Platform Administrator",
    verificationStatus: "verified" as const,
  },
  {
    name: "Ama Boateng",
    email: "alumni.demo@alumnisphere.ug",
    role: "alumni" as const,
    headline: "Software Engineer · Class of 2018",
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
  },
  {
    name: "Kwame Mensah",
    email: "student.demo@alumnisphere.ug",
    role: "student" as const,
    headline: "Final-year Computer Science student",
    programme: "Computer Science",
    department: "Computer Science",
    location: "Legon, Accra",
    skills: ["Python", "Research"],
    openToWork: true,
    verificationStatus: "unverified" as const,
  },
  {
    name: "Efua Asante",
    email: "efua.asante@alumnisphere.ug",
    role: "alumni" as const,
    headline: "Product Manager · Class of 2016",
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
  },
  {
    name: "Yaw Owusu",
    email: "yaw.owusu@alumnisphere.ug",
    role: "alumni" as const,
    headline: "Civil Engineer · Class of 2014",
    graduationYear: 2014,
    programme: "Civil Engineering",
    department: "Civil Engineering",
    industry: "Infrastructure",
    company: "Ghana Highways Authority",
    jobTitle: "Project Engineer",
    location: "Kumasi, Ghana",
    skills: ["Infrastructure", "Project Management"],
    openToWork: false,
    openToMentor: true,
    verificationStatus: "verified" as const,
  },
];

async function seed() {
  await connectDB();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const account of accounts) {
    const existing = await User.findOne({ email: account.email });
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.role = account.role;
      existing.accountStatus = "active";
      existing.verificationStatus = account.verificationStatus;
      existing.headline = account.headline;
      if ("graduationYear" in account) Object.assign(existing, account);
      await existing.save();
      console.log(`[seed] Updated ${account.email}`);
      continue;
    }

    await User.create({
      ...account,
      passwordHash,
      accountStatus: "active",
    });
    console.log(`[seed] Created ${account.email}`);
  }

  const users = await User.find({ email: { $in: accounts.map((item) => item.email) } });
  const byEmail = Object.fromEntries(users.map((user) => [user.email, user]));
  const ama = byEmail["alumni.demo@alumnisphere.ug"];
  const kwame = byEmail["student.demo@alumnisphere.ug"];
  const efua = byEmail["efua.asante@alumnisphere.ug"];
  const yaw = byEmail["yaw.owusu@alumnisphere.ug"];

  if (ama && efua && yaw && kwame) {
    for (const [requester, addressee] of [
      [ama, efua],
      [ama, yaw],
      [ama, kwame],
    ] as const) {
      const pairKey = connectionPairKey(requester._id.toString(), addressee._id.toString());
      await Connection.findOneAndUpdate(
        { pairKey },
        {
          requesterId: requester._id,
          addresseeId: addressee._id,
          pairKey,
          status: "accepted",
        },
        { upsert: true, new: true }
      );
    }
    console.log("[seed] Accepted demo connections");

    const publicCommunity =
      (await Community.findOne({ slug: "computer-science-alumni" })) ??
      (await Community.create({
        name: "Computer Science Alumni",
        slug: "computer-science-alumni",
        description: "Public space for CS alumni, students, and mentors.",
        isPrivate: false,
        ownerId: ama._id,
        memberCount: 3,
      }));
    const privateCommunity =
      (await Community.findOne({ slug: "class-of-2018" })) ??
      (await Community.create({
        name: "Class of 2018",
        slug: "class-of-2018",
        description: "Private community for the 2018 graduating class.",
        isPrivate: true,
        ownerId: ama._id,
        memberCount: 2,
      }));

    for (const [community, user, role] of [
      [publicCommunity, ama, "owner"],
      [publicCommunity, efua, "moderator"],
      [publicCommunity, kwame, "member"],
      [privateCommunity, ama, "owner"],
      [privateCommunity, yaw, "member"],
    ] as const) {
      await CommunityMember.findOneAndUpdate(
        { communityId: community._id, userId: user._id },
        { communityId: community._id, userId: user._id, role },
        { upsert: true }
      );
    }
    console.log("[seed] Demo communities");

    const existingFeed = await Post.findOne({ authorId: ama._id, communityId: { $exists: false } });
    if (!existingFeed) {
      await Post.create({
        authorId: ama._id,
        type: "text",
        body: "Welcome to the AlumniSphere feed. Share updates, links, and polls with the network.",
      });
      await Post.create({
        authorId: efua._id,
        type: "link",
        body: "A useful product note for alumni building in Ghana.",
        linkUrl: "https://www.ug.edu.gh",
      });
      await Post.create({
        authorId: ama._id,
        type: "poll",
        body: "Help us plan the next alumni clinic.",
        pollQuestion: "Which session should we run first?",
        pollOptions: [
          { text: "Mentorship office hours", voteCount: 0 },
          { text: "Job-search clinic", voteCount: 0 },
          { text: "Startup office hours", voteCount: 0 },
        ],
      });
      await Post.create({
        authorId: ama._id,
        communityId: publicCommunity._id,
        type: "text",
        body: "CS alumni: drop your current stack and whether you are open to mentor a student.",
      });
      console.log("[seed] Demo posts");
    }

    const pairKey = conversationPairKey(ama._id.toString(), efua._id.toString());
    let conversation = await Conversation.findOne({ pairKey });
    if (!conversation) {
      conversation = await Conversation.create({
        pairKey,
        participantIds: [ama._id, efua._id],
        lastMessagePreview: "Shall we host a product clinic next month?",
        lastMessageAt: new Date(),
        unread: { [ama._id.toString()]: 0, [efua._id.toString()]: 1 },
      });
      await Message.create({
        conversationId: conversation._id,
        senderId: efua._id,
        body: "Shall we host a product clinic next month?",
      });
      console.log("[seed] Demo conversation");
    }

    const softwareJob =
      (await Job.findOne({ title: "Software Engineer, Alumni Products" })) ??
      (await Job.create({
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
      }));
      const internExists = await Job.findOne({ title: "Product intern, alumni programmes" });
      if (!internExists) {
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
      }
    await JobApplication.findOneAndUpdate(
      { jobId: softwareJob._id, applicantId: kwame._id },
      {
        jobId: softwareJob._id,
        applicantId: kwame._id,
        coverNote:
          "I am a final-year CS student looking for a product engineering internship-to-hire path at UG.",
        status: "submitted",
      },
      { upsert: true }
    );
    console.log("[seed] Demo jobs");

    const amaKwameKey = mentorshipPairKey(ama._id.toString(), kwame._id.toString());
    await Mentorship.findOneAndUpdate(
      { pairKey: amaKwameKey },
      {
        mentorId: ama._id,
        menteeId: kwame._id,
        pairKey: amaKwameKey,
        status: "active",
        goals: [{ text: "Review Kwame's CV and internship applications", done: false }],
      },
      { upsert: true }
    );
    await MentorshipRequest.findOneAndUpdate(
      { pairKey: amaKwameKey, status: "accepted" },
      {
        menteeId: kwame._id,
        mentorId: ama._id,
        pairKey: amaKwameKey,
        message: "I would like monthly feedback on internships and a first engineering role.",
        status: "accepted",
      },
      { upsert: true }
    );
    const yawKwameKey = mentorshipPairKey(yaw._id.toString(), kwame._id.toString());
    await MentorshipRequest.findOneAndUpdate(
      { pairKey: yawKwameKey, status: "pending" },
      {
        menteeId: kwame._id,
        mentorId: yaw._id,
        pairKey: yawKwameKey,
        message: "I want advice on moving from campus projects into infrastructure internships.",
        status: "pending",
      },
      { upsert: true }
    );
    console.log("[seed] Demo mentorship");

    const admin = byEmail["admin@alumnisphere.ug"];
    if (admin) {
      const mixer =
        (await Event.findOne({ title: "Accra alumni mixer" })) ??
        (await Event.create({
          title: "Accra alumni mixer",
          description:
            "An evening for UG alumni and final-year students to meet mentors, hiring managers, and classmates.",
          location: "Accra, Ghana",
          startsAt: new Date("2026-09-12T18:00:00.000Z"),
          endsAt: new Date("2026-09-12T21:00:00.000Z"),
          capacity: 80,
          status: "published",
          createdById: admin._id,
        }));
      if (!(await Event.findOne({ title: "Career clinic (draft)" }))) {
        await Event.create({
          title: "Career clinic (draft)",
          description: "Small-group CV and interview practice. Publish when facilitators are confirmed.",
          location: "Legon, Accra",
          startsAt: new Date("2026-10-04T10:00:00.000Z"),
          capacity: 24,
          status: "draft",
          createdById: admin._id,
        });
      }
      if (!(await Event.findOne({ title: "Kumasi cancelled mixer" }))) {
        await Event.create({
          title: "Kumasi cancelled mixer",
          description: "Postponed due to venue unavailability. Kept as a cancelled record.",
          location: "Kumasi, Ghana",
          startsAt: new Date("2026-08-20T18:00:00.000Z"),
          status: "cancelled",
          createdById: admin._id,
        });
      }
      await EventRegistration.findOneAndUpdate(
        { eventId: mixer._id, userId: kwame._id },
        { eventId: mixer._id, userId: kwame._id },
        { upsert: true }
      );
      console.log("[seed] Demo events");

      const scholarship =
        (await Campaign.findOne({ title: "CS scholarship fund" })) ??
        (await Campaign.create({
          title: "CS scholarship fund",
          description:
            "Support need-based scholarships for Computer Science students at the University of Ghana. Records only — no card payment is taken.",
          goalAmount: 50000,
          deadline: new Date("2026-12-31T23:59:59.000Z"),
          status: "active",
          createdById: admin._id,
        }));
      if (!(await Campaign.findOne({ title: "Library draft appeal" }))) {
        await Campaign.create({
          title: "Library draft appeal",
          description: "Draft campaign for Balme Library equipment. Publish when the goal is confirmed.",
          goalAmount: 20000,
          status: "draft",
          createdById: admin._id,
        });
      }
      const existingGift = await Contribution.findOne({ campaignId: scholarship._id, contributorId: ama._id });
      if (!existingGift) {
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
      }
      const existingNote = await Notification.findOne({ userId: kwame._id, title: "Welcome to AlumniSphere" });
      if (!existingNote) {
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
          href: "/mentorship",
          read: false,
        });
      }
      const feedPost = await Post.findOne({ type: "text", communityId: { $exists: false } });
      if (feedPost) {
        await Report.findOneAndUpdate(
          { reporterId: kwame._id, targetType: "post", targetId: feedPost._id },
          {
            reporterId: kwame._id,
            targetType: "post",
            targetId: feedPost._id,
            reason: "This looks like a test post and should be reviewed for tone.",
            status: "open",
          },
          { upsert: true }
        );
      }
      console.log("[seed] Demo campaigns, notifications, and a report");
    }
  }

  console.log(`[seed] Demo password for all seeded accounts: ${DEMO_PASSWORD}`);
  process.exit(0);
}

seed().catch((error) => {
  console.error("[seed] Failed:", error);
  process.exit(1);
});
