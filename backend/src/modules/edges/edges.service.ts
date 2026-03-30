import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Edge } from './entities/edge.entity';
import { CreateEdgeDto } from './dto/create-edge.dto';

@Injectable()
export class EdgesService {
  constructor(
    @InjectRepository(Edge)
    private readonly edgeRepository: Repository<Edge>,
  ) {}

  async findByWorkflow(workflowId: string): Promise<Edge[]> {
    return this.edgeRepository.find({
      where: { workflowId },
    });
  }

  async create(workflowId: string, dto: CreateEdgeDto): Promise<Edge> {
    if (dto.sourceNodeId === dto.targetNodeId) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Self-loop connections are not allowed',
      });
    }

    const edge = this.edgeRepository.create({
      ...dto,
      workflowId,
    });
    return this.edgeRepository.save(edge);
  }

  async remove(id: string): Promise<void> {
    const edge = await this.edgeRepository.findOne({ where: { id } });
    if (!edge) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Edge not found',
      });
    }
    await this.edgeRepository.remove(edge);
  }
}
