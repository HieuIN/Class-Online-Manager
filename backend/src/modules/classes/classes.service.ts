import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Class } from './class.entity';

@Injectable()
export class ClassesService {
  constructor(
    @InjectRepository(Class) private repo: Repository<Class>,
    private dataSource: DataSource,
  ) {}

  /**
   * Returns classes with teacher info, student count, and done session count.
   * Uses raw SQL for efficient aggregation.
   */
  async findAllWithStats(filter: { teacherId?: number; studentId?: number } = {}) {
    let sql = `
      SELECT c.*,
             u.full_name as "teacherName",
             co.name as "courseName",
             COALESCE(stu.cnt, 0)::int as "studentCount",
             COALESCE(ses.done_cnt, 0)::int as "doneSessions"
      FROM classes c
      LEFT JOIN users u ON u.id = c.teacher_id
      LEFT JOIN courses co ON co.id = c.course_id
      LEFT JOIN (SELECT class_id, COUNT(*) as cnt FROM enrollments WHERE is_active = true GROUP BY class_id) stu ON stu.class_id = c.id
      LEFT JOIN (SELECT class_id, COUNT(*) as done_cnt FROM sessions WHERE status = 'DONE' GROUP BY class_id) ses ON ses.class_id = c.id
      WHERE c.is_active = true
    `;
    const params: any[] = [];
    if (filter.teacherId) {
      params.push(filter.teacherId);
      sql += ` AND c.teacher_id = $${params.length}`;
    }
    if (filter.studentId) {
      params.push(filter.studentId);
      sql += ` AND c.id IN (SELECT class_id FROM enrollments WHERE student_id = $${params.length} AND is_active = true)`;
    }
    sql += ' ORDER BY c.id DESC';
    return this.dataSource.query(sql, params);
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  create(data: Partial<Class>) {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: number, data: Partial<Class>) {
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  remove(id: number) {
    return this.repo.update(id, { isActive: false });
  }

  async getStudentsInClass(classId: number) {
    return this.dataSource.query(
      `SELECT u.id, u.email, u.phone, u.full_name as "fullName", u.avatar_url as "avatarUrl",
              e.enrolled_at as "enrolledAt"
       FROM enrollments e JOIN users u ON u.id = e.student_id
       WHERE e.class_id = $1 AND e.is_active = true ORDER BY u.full_name`,
      [classId],
    );
  }
}
