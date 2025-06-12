# Email Service Backend

This is the backend source code for a complete email application, built with Node.js and Express.js. The system is designed to handle operations related to user accounts, sending/receiving emails, mailbox management, and other advanced features.

# Flutter App
* Repository for application: https://github.com/nguyenchanh0201/ses_app

## Tech Stack 🛠️

* **Framework**: [Express.js](https://expressjs.com/)
* **Database**: [PostgreSQL](https://www.postgresql.org/) (Hosted on [Neon](https://neon.tech/))
* **ORM**: [Sequelize](https://sequelize.org/)
* **File Storage (Attachments)**: [AWS S3](https://aws.amazon.com/s3/)
* **SMS Messaging (2FA)**: [AWS SNS](https://aws.amazon.com/sns/)
* **Authentication**: JWT (JSON Web Tokens)

---

## Key Features ✅

Below is a list of features supported by this backend, grouped by functionality.

### 👤 Account Management & Security

* Change password.
* Password recovery.
* Enable and use two-factor authentication (2FA via SMS).
* View and change personal information (profile).
* Change profile picture.

### 📧 Composing & Sending Emails

* Send simple text emails.
* Advanced text editing (WYSIWYG).
* Send and receive file attachments (stored on S3).
* Send emails with CC and BCC recipients.
* Forward an email.
* Auto-save composing emails as drafts.

### 📥 Mailbox Management

* View email lists in different categories (inbox, sent, etc.).
* View emails in basic and detailed views.
* Add/remove labels to an email.
* View email lists by label.
* Star an email.
* Search emails by keyword.
* Advanced search with multiple criteria.

### ✨ User Experience & Utilities

* Perform actions on an email (e.g., view metadata).
* User settings screen.
* Auto-reply feature.

---

## Installation & Setup

### Run local
To run this project on your local machine, follow these steps:

1.  **Clone the repository**
    ```bash
    git clone <your-repository-url>
    cd <repository-folder>
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure environment variables**
    Create a `.env` file in the project's root directory by copying the `.env.example` file.
    ```bash
    cp .env.example .env
    ```
    Then, open the `.env` file and fill in the required values.

4.  **Run database migrations (if needed)**
    ```bash
    npx sequelize-cli db:migrate
    ```

5.  **Start the server**
    To run in development mode with hot-reloading:
    ```bash
    npm run dev
    ```
    To run in production mode:
    ```bash
    npm start
    ```
    The server will run at `http://localhost:PORT` (where `PORT` is defined in your `.env` file).

---

### Run with Docker

To run this project using Docker, make sure you have Docker installed and running on your machine. You can use the Dockerfile or create your own.

1.  **Build the Docker Image**
    
    From the project's root directory, run the following command to build the Docker image. Replace `email-service-backend` with your desired image name.
    
    ```bash
    docker build -t email-service-backend .
    ```
    
2.  **Run the Docker Container**
    
    After the image is built, run the following command to start a container from it. This command maps port `3001` on your local machine to port `3001` inside the container and passes the environment variables from your `.env` file.
    
    ```bash
    docker run -d -p 3001:3001 --env-file ./.env --name email-service-container email-service-backend
    ```
    
## Environment Variables (.env)

Below is the list of environment variables required for the project to work:

```env
# Server Configuration
PORT=3001

# PostgreSQL Database (Neon)
DATABASE_URL="postgres://user:password@host:port/dbname"

# JSON Web Token
SECRET_JWT="your_super_secret_jwt_key"

# AWS Credentials
AWS_ACCESS_KEY_ID="your_aws_access_key"
AWS_SECRET_ACCESS_KEY="your_aws_secret_key"
AWS_REGION="your_aws_region"

# AWS S3 Bucket for Attachments
S3_BUCKET_NAME="your_s3_bucket_name"