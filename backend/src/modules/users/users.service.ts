import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  private normalizeBirthDate(value: unknown) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;

    const birthDate = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      throw new BadRequestException('Ngày sinh không hợp lệ');
    }

    const parsed = new Date(`${birthDate}T00:00:00.000Z`);
    if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== birthDate || parsed > new Date()) {
      throw new BadRequestException('Ngày sinh không hợp lệ');
    }
    return birthDate;
  }

  findAll(role?: string) {
    const where = role ? { role } : {};
    return this.repo.find({ where, select: ['id','email','phone','fullName','role','avatarUrl','school','birthDate','isActive','mustChangePassword','createdAt'] });
  }

  async findOne(id: number) {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    const { passwordHash, ...result } = user;
    return result;
  }

  async create(data: any) {
    const birthDate = this.normalizeBirthDate(data.birthDate);
    if (birthDate !== undefined) data.birthDate = birthDate;
    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 10);
      data.mustChangePassword = data.mustChangePassword !== false;
      delete data.password;
    }
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  async update(id: number, data: any) {
    const birthDate = this.normalizeBirthDate(data.birthDate);
    if (birthDate !== undefined) data.birthDate = birthDate;
    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 10);
      data.mustChangePassword = data.mustChangePassword !== false;
      delete data.password;
    }
    await this.repo.update(id, data);
    return this.findOne(id);
  }

  remove(id: number) {
    return this.repo.update(id, { isActive: false });
  }
}
