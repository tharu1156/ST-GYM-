# Gym Management System (Frontend)

Static frontend UI for the Gym Management System using HTML, CSS, Bootstrap, and JavaScript.

## Backend API
The ASP.NET Core Web API lives in the GymManagement.Api folder.

Run the API:
1. Update the MySQL connection string in GymManagement.Api/appsettings.Development.json
2. Start the API:
	dotnet run --project GymManagement.Api

API base URL (default):
- https://localhost:7276/api

## Database
MySQL schema is in database/schema.sql.

## Pages
- Login: login.html
- Dashboard: index.html
- Members: members.html
- Memberships: memberships.html
- Payments: payments.html
- Attendance: attendance.html
- Support & Reviews: support.html

## Run
Open any HTML file in a browser (start with index.html).
