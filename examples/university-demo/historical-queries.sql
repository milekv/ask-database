SELECT s.id, s.full_name, s.email, d.name AS department_name
FROM students s
JOIN departments d ON s.department_id = d.id
WHERE s.status = 'active'
ORDER BY s.created_at DESC
LIMIT 50;

SELECT c.code, c.title, COUNT(e.id) AS enrollment_count
FROM courses c
LEFT JOIN enrollments e ON e.course_id = c.id
GROUP BY c.code, c.title
ORDER BY enrollment_count DESC
LIMIT 20;

SELECT s.full_name, c.title, g.grade
FROM students s
JOIN enrollments e ON e.student_id = s.id
JOIN courses c ON e.course_id = c.id
JOIN grades g ON g.enrollment_id = e.id
WHERE g.grade >= 4.5
ORDER BY g.grade DESC;
