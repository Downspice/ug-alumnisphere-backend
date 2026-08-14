export const typeDefs = `#graphql
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
    role: String!
    createdAt: String!
    updatedAt: String!
  }

  input CreateUserInput {
    name: String!
    email: String!
    role: String
  }

  type HealthStatus {
    status: String!
    timestamp: String!
    database: String!
    uptime: Float!
  }

  type Query {
    health: HealthStatus!
    exams(isPublished: Boolean): [Exam!]!
    exam(id: ID!): Exam
    users: [User!]!
    user(id: ID!): User
  }

  type Mutation {
    createExam(input: CreateExamInput!): Exam!
    updateExam(id: ID!, input: UpdateExamInput!): Exam
    deleteExam(id: ID!): Boolean!
    createUser(input: CreateUserInput!): User!
  }
`;
