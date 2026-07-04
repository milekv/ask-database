CREATE TABLE departments (
  id integer primary key,
  name varchar(160) not null unique,
  code varchar(24) not null unique
);

CREATE TABLE students (
  id integer primary key,
  department_id integer not null references departments(id),
  full_name varchar(220) not null,
  email varchar(220) not null unique,
  status varchar(32) not null,
  created_at timestamp not null
);

CREATE TABLE courses (
  id integer primary key,
  department_id integer not null references departments(id),
  code varchar(32) not null unique,
  title varchar(220) not null,
  credits integer not null
);

CREATE TABLE enrollments (
  id integer primary key,
  student_id integer not null references students(id),
  course_id integer not null references courses(id),
  enrolled_at timestamp not null
);

CREATE TABLE grades (
  id integer primary key,
  enrollment_id integer not null references enrollments(id),
  grade numeric(4,2) not null,
  graded_at timestamp not null
);
