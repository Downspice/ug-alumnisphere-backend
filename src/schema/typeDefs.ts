export const typeDefs = `#graphql
  enum UserRole {
    alumni
    student
    admin
  }

  enum AccountStatus {
    active
    suspended
    pending
  }

  enum VerificationStatus {
    unverified
    pending
    verified
    rejected
  }

  type Question {
    questionText: String!
    options: [String!]!
    correctOptionIndex: Int!
    points: Int!
  }

  input QuestionInput {
    questionText: String!
    options: [String!]!
    correctOptionIndex: Int!
    points: Int
  }

  type Exam {
    id: ID!
    title: String!
    description: String
    durationMinutes: Int!
    totalMarks: Int!
    passingMarks: Int!
    questions: [Question!]!
    isPublished: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  input CreateExamInput {
    title: String!
    description: String
    durationMinutes: Int!
    totalMarks: Int!
    passingMarks: Int!
    questions: [QuestionInput!]
    isPublished: Boolean
  }

  input UpdateExamInput {
    title: String
    description: String
    durationMinutes: Int
    totalMarks: Int
    passingMarks: Int
    questions: [QuestionInput!]
    isPublished: Boolean
  }

  type User {
    id: ID!
    name: String!
    email: String!
    role: UserRole!
    accountStatus: AccountStatus!
    verificationStatus: VerificationStatus!
    verificationRejectionReason: String
    headline: String
    about: String
    location: String
    graduationYear: Int
    programme: String
    department: String
    faculty: String
    industry: String
    company: String
    jobTitle: String
    skills: [String!]!
    openToWork: Boolean!
    openToMentor: Boolean!
    avatarUrl: String
    avatarPath: String
    createdAt: String!
    updatedAt: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  input RegisterInput {
    name: String!
    email: String!
    password: String!
    role: UserRole
  }

  input LoginInput {
    email: String!
    password: String!
  }

  input CreateUserInput {
    name: String!
    email: String!
    password: String!
    role: UserRole
  }

  input UpdateProfileInput {
    name: String
    headline: String
    about: String
    location: String
    graduationYear: Int
    programme: String
    department: String
    faculty: String
    industry: String
    company: String
    jobTitle: String
    skills: [String!]
    openToWork: Boolean
    openToMentor: Boolean
    avatarFileId: ID
  }

  type HealthStatus {
    status: String!
    timestamp: String!
    database: String!
    uptime: Float!
  }

  enum DirectorySort {
    RECENT
    NAME_ASC
    YEAR_DESC
  }

  enum ConnectionStatus {
    pending
    accepted
    declined
  }

  input DirectoryFilter {
    query: String
    graduationYear: Int
    programme: String
    department: String
    faculty: String
    industry: String
    company: String
    jobTitle: String
    location: String
    skill: String
    openToMentor: Boolean
    openToWork: Boolean
    verificationStatus: VerificationStatus
  }

  type DirectoryPage {
    items: [User!]!
    total: Int!
    page: Int!
    pageSize: Int!
    hasNextPage: Boolean!
  }

  type VerificationRequest {
    id: ID!
    applicant: User!
    graduationYear: Int!
    programme: String!
    studentNumber: String!
    notes: String
    documentFileName: String
    documentDownloadUrl: String
    status: VerificationStatus!
    rejectionReason: String
    reviewedBy: User
    reviewedAt: String
    createdAt: String!
  }

  input SubmitVerificationInput {
    graduationYear: Int!
    programme: String!
    studentNumber: String!
    notes: String
    documentFileName: String
    documentFileId: ID
  }

  type Connection {
    id: ID!
    requester: User!
    addressee: User!
    status: ConnectionStatus!
    createdAt: String!
    updatedAt: String!
  }

  type SuggestedConnection {
    user: User!
    reasons: [String!]!
  }

  type Conversation {
    id: ID!
    participants: [User!]!
    lastMessagePreview: String!
    lastMessageAt: String!
    unreadCount: Int!
  }

  type Message {
    id: ID!
    sender: User!
    body: String!
    createdAt: String!
  }

  enum CommunityRole {
    owner
    moderator
    member
  }

  type Community {
    id: ID!
    name: String!
    slug: String!
    description: String!
    isPrivate: Boolean!
    owner: User
    memberCount: Int!
    myRole: CommunityRole
    joinRequestPending: Boolean!
    createdAt: String!
  }

  type CommunityMember {
    id: ID!
    user: User
    role: CommunityRole!
    createdAt: String!
  }

  type CommunityJoinRequest {
    id: ID!
    user: User
    status: String!
    createdAt: String!
  }

  input CreateCommunityInput {
    name: String!
    description: String
    isPrivate: Boolean
  }

  input UpdateCommunityInput {
    name: String
    description: String
  }

  enum PostType {
    text
    link
    poll
    image
  }

  type PollOption {
    text: String!
    voteCount: Int!
  }

  type Post {
    id: ID!
    author: User
    community: Community
    type: PostType!
    body: String!
    imageUrl: String
    linkUrl: String
    pollQuestion: String
    pollOptions: [PollOption!]!
    pollClosesAt: String
    pollClosed: Boolean!
    pollTotalVotes: Int!
    myPollVote: Int
    likeCount: Int!
    commentCount: Int!
    likedByMe: Boolean!
    savedByMe: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type Comment {
    id: ID!
    author: User
    parentId: ID
    body: String!
    createdAt: String!
  }

  input CreatePostInput {
    communityId: ID
    type: PostType!
    body: String
    linkUrl: String
    pollQuestion: String
    pollOptions: [String!]
    pollClosesAt: String
    imageFileId: ID
  }

  enum JobType {
    full_time
    part_time
    internship
    contract
  }

  enum JobStatus {
    open
    closed
  }

  enum JobSort {
    RECENT
    TITLE_ASC
  }

  enum ApplicationStatus {
    submitted
    reviewing
    shortlisted
    rejected
    withdrawn
  }

  type Job {
    id: ID!
    title: String!
    company: String!
    location: String!
    type: JobType!
    industry: String!
    description: String!
    requirements: String!
    applicationUrl: String
    postedBy: User
    status: JobStatus!
    savedByMe: Boolean!
    myApplication: JobApplication
    applicationCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  type JobApplication {
    id: ID!
    job: Job!
    applicant: User
    coverNote: String!
    resumeFileName: String
    resumeDownloadUrl: String
    status: ApplicationStatus!
    createdAt: String!
    updatedAt: String!
  }

  input CreateJobInput {
    title: String!
    company: String!
    location: String!
    type: JobType!
    industry: String
    description: String!
    requirements: String
    applicationUrl: String
  }

  enum MentorshipRequestStatus {
    pending
    accepted
    declined
  }

  type MentorshipRequest {
    id: ID!
    mentee: User
    mentor: User
    message: String!
    status: MentorshipRequestStatus!
    createdAt: String!
  }

  type MentorshipGoal {
    id: ID!
    text: String!
    done: Boolean!
  }

  type Mentorship {
    id: ID!
    mentor: User
    mentee: User
    status: String!
    goals: [MentorshipGoal!]!
    createdAt: String!
    updatedAt: String!
  }

  enum EventStatus {
    draft
    published
    cancelled
  }

  type Event {
    id: ID!
    title: String!
    description: String!
    location: String!
    startsAt: String!
    endsAt: String
    capacity: Int
    status: EventStatus!
    createdBy: User
    registeredCount: Int!
    registeredByMe: Boolean!
    createdAt: String!
  }

  type EventRegistration {
    id: ID!
    event: Event!
    user: User
    createdAt: String!
  }

  input CreateEventInput {
    title: String!
    description: String!
    location: String!
    startsAt: String!
    endsAt: String
    capacity: Int
  }

  enum CampaignStatus {
    draft
    active
    closed
  }

  type Campaign {
    id: ID!
    title: String!
    description: String!
    goalAmount: Float!
    raisedAmount: Float!
    remainingAmount: Float!
    progressPercent: Int!
    contributorCount: Int!
    deadline: String
    status: CampaignStatus!
    createdBy: User
    createdAt: String!
  }

  type Contribution {
    id: ID!
    campaign: Campaign!
    contributor: User
    amount: Float!
    anonymous: Boolean!
    note: String!
    status: String!
    createdAt: String!
  }

  input CreateCampaignInput {
    title: String!
    description: String!
    goalAmount: Float!
    deadline: String
  }

  input UpdateCampaignInput {
    title: String
    description: String
    goalAmount: Float
    deadline: String
  }

  type Notification {
    id: ID!
    title: String!
    body: String!
    href: String!
    read: Boolean!
    createdAt: String!
  }

  type AdminOverview {
    users: Int!
    jobs: Int!
    applications: Int!
    events: Int!
    registrations: Int!
    communities: Int!
    campaigns: Int!
    contributions: Int!
    openReports: Int!
    pendingVerifications: Int!
  }

  type AnalyticsPoint {
    label: String!
    value: Float!
    goal: Float
  }

  type AdminAnalytics {
    usersByRole: [AnalyticsPoint!]!
    jobsByType: [AnalyticsPoint!]!
    eventsByStatus: [AnalyticsPoint!]!
    campaignProgress: [AnalyticsPoint!]!
    contributionsByMonth: [AnalyticsPoint!]!
    source: String!
  }

  type ContentReport {
    id: ID!
    reporter: User
    targetType: String!
    targetId: ID!
    reason: String!
    status: String!
    createdAt: String!
  }

  input UpdateEventInput {
    title: String
    description: String
    location: String
    startsAt: String
    endsAt: String
    capacity: Int
  }

  type Query {
    health: HealthStatus!
    me: User
    exams(isPublished: Boolean): [Exam!]!
    exam(id: ID!): Exam
    users: [User!]!
    user(id: ID!): User
    alumniDirectory(
      filter: DirectoryFilter
      sort: DirectorySort
      page: Int
      pageSize: Int
    ): DirectoryPage!
    publicProfile(id: ID!): User
    myVerificationRequest: VerificationRequest
    verificationRequests(status: VerificationStatus): [VerificationRequest!]!
    myConnections: [Connection!]!
    pendingConnectionRequests: [Connection!]!
    sentConnectionRequests: [Connection!]!
    suggestedConnections: [SuggestedConnection!]!
    connectionStatus(userId: ID!): Connection
    conversations(search: String): [Conversation!]!
    conversation(id: ID!): Conversation
    messages(conversationId: ID!): [Message!]!
    communities(search: String, mine: Boolean): [Community!]!
    community(id: ID!): Community
    communityMembers(communityId: ID!): [CommunityMember!]!
    communityJoinRequests(communityId: ID!): [CommunityJoinRequest!]!
    feed(communityId: ID): [Post!]!
    post(id: ID!): Post
    comments(postId: ID!): [Comment!]!
    savedPosts: [Post!]!
    jobs(search: String, type: JobType, location: String, industry: String, sort: JobSort): [Job!]!
    job(id: ID!): Job
    myJobApplications: [JobApplication!]!
    jobApplications(jobId: ID!): [JobApplication!]!
    savedJobs: [Job!]!
    myPostedJobs: [Job!]!
    mentors(search: String, industry: String, location: String): [User!]!
    mentorshipRequestStatus(userId: ID!): MentorshipRequest
    incomingMentorshipRequests: [MentorshipRequest!]!
    sentMentorshipRequests: [MentorshipRequest!]!
    myMentorships: [Mentorship!]!
    events(search: String, location: String, includeUnpublished: Boolean): [Event!]!
    event(id: ID!): Event
    myEventRegistrations: [EventRegistration!]!
    campaigns(search: String, includeUnpublished: Boolean): [Campaign!]!
    campaign(id: ID!): Campaign
    campaignContributions(campaignId: ID!): [Contribution!]!
    myContributions: [Contribution!]!
    notifications: [Notification!]!
    unreadNotificationCount: Int!
    adminOverview: AdminOverview!
    adminAnalytics: AdminAnalytics!
    contentReports(status: String): [ContentReport!]!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(input: LoginInput!): AuthPayload!
    logout: Boolean!
    updateMyProfile(input: UpdateProfileInput!): User!
    submitVerification(input: SubmitVerificationInput!): VerificationRequest!
    reviewVerification(id: ID!, approve: Boolean!, rejectionReason: String): VerificationRequest!
    sendConnectionRequest(userId: ID!): Connection!
    acceptConnectionRequest(id: ID!): Connection!
    declineConnectionRequest(id: ID!): Connection!
    removeConnection(userId: ID!): Boolean!
    startConversation(userId: ID!): Conversation!
    sendMessage(conversationId: ID!, body: String!): Message!
    markConversationRead(conversationId: ID!): Conversation!
    createCommunity(input: CreateCommunityInput!): Community!
    updateCommunity(id: ID!, input: UpdateCommunityInput!): Community!
    joinCommunity(id: ID!): Community!
    leaveCommunity(id: ID!): Boolean!
    reviewJoinRequest(id: ID!, approve: Boolean!): CommunityJoinRequest!
    assignModerator(communityId: ID!, userId: ID!, makeModerator: Boolean!): CommunityMember!
    createPost(input: CreatePostInput!): Post!
    updatePost(id: ID!, body: String!): Post!
    deletePost(id: ID!): Boolean!
    toggleLike(postId: ID!): Post!
    addComment(postId: ID!, body: String!, parentId: ID): Comment!
    deleteComment(id: ID!): Boolean!
    toggleSavePost(postId: ID!): Boolean!
    reportContent(targetType: String!, targetId: ID!, reason: String!): Boolean!
    votePoll(postId: ID!, optionIndex: Int!): Post!
    createJob(input: CreateJobInput!): Job!
    closeJob(id: ID!): Job!
    applyToJob(jobId: ID!, coverNote: String!, resumeFileId: ID): JobApplication!
    withdrawApplication(id: ID!): JobApplication!
    updateApplicationStatus(id: ID!, status: ApplicationStatus!): JobApplication!
    toggleSaveJob(jobId: ID!): Boolean!
    requestMentorship(mentorId: ID!, message: String!): MentorshipRequest!
    acceptMentorshipRequest(id: ID!): Mentorship!
    declineMentorshipRequest(id: ID!): MentorshipRequest!
    addMentorshipGoal(mentorshipId: ID!, text: String!): Mentorship!
    toggleMentorshipGoal(mentorshipId: ID!, goalId: ID!): Mentorship!
    closeMentorship(id: ID!): Mentorship!
    createEvent(input: CreateEventInput!): Event!
    updateEvent(id: ID!, input: UpdateEventInput!): Event!
    publishEvent(id: ID!): Event!
    cancelEvent(id: ID!): Event!
    registerForEvent(eventId: ID!): EventRegistration!
    cancelEventRegistration(eventId: ID!): Boolean!
    createCampaign(input: CreateCampaignInput!): Campaign!
    updateCampaign(id: ID!, input: UpdateCampaignInput!): Campaign!
    publishCampaign(id: ID!): Campaign!
    closeCampaign(id: ID!): Campaign!
    recordContribution(campaignId: ID!, amount: Float!, anonymous: Boolean, note: String): Contribution!
    markNotificationRead(id: ID!): Notification!
    markAllNotificationsRead: Boolean!
    setUserAccountStatus(id: ID!, status: AccountStatus!): User!
    reviewReport(id: ID!): ContentReport!
    createExam(input: CreateExamInput!): Exam!
    updateExam(id: ID!, input: UpdateExamInput!): Exam
    deleteExam(id: ID!): Boolean!
    createUser(input: CreateUserInput!): User!
  }
`;
