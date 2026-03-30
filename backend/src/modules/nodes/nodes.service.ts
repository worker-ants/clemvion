import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Node } from './entities/node.entity';
import { CreateNodeDto } from './dto/create-node.dto';
import { UpdateNodeDto } from './dto/update-node.dto';

@Injectable()
export class NodesService {
  constructor(
    @InjectRepository(Node)
    private readonly nodeRepository: Repository<Node>,
  ) {}

  async findByWorkflow(workflowId: string): Promise<Node[]> {
    return this.nodeRepository.find({
      where: { workflowId },
      order: { createdAt: 'ASC' },
    });
  }

  async findById(id: string): Promise<Node> {
    const node = await this.nodeRepository.findOne({ where: { id } });
    if (!node) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Node not found',
      });
    }
    return node;
  }

  async create(workflowId: string, dto: CreateNodeDto): Promise<Node> {
    const node = this.nodeRepository.create({ ...dto, workflowId });
    return this.nodeRepository.save(node);
  }

  async update(id: string, dto: UpdateNodeDto): Promise<Node> {
    const node = await this.findById(id);
    Object.assign(node, dto);
    return this.nodeRepository.save(node);
  }

  async remove(id: string): Promise<void> {
    const node = await this.findById(id);
    await this.nodeRepository.remove(node);
  }

  async bulkCreate(workflowId: string, dtos: CreateNodeDto[]): Promise<Node[]> {
    const nodes = dtos.map((dto) =>
      this.nodeRepository.create({ ...dto, workflowId }),
    );
    return this.nodeRepository.save(nodes);
  }
}
