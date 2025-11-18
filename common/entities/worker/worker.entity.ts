import { Column, Entity, OneToMany } from 'typeorm';
import ActionEntity from '../action/action.entity';
import BaseEntity from '../base-entity.entity';

@Entity({ name: 'worker' })
export default class WorkerEntity extends BaseEntity {
    @Column({ unique: true })
    identifier!: string;

    @Column()
    hostname!: string;

    @Column()
    cpuMemory!: number;

    @Column({ nullable: true })
    gpuModel?: string;

    @Column({ default: -1 })
    gpuMemory!: number;

    @Column()
    cpuCores!: number;

    @Column()
    cpuModel!: string;

    @Column()
    storage!: number;

    @Column()
    lastSeen!: Date;

    @Column()
    reachable!: boolean;

    @OneToMany(() => ActionEntity, (action) => action.worker)
    actions?: ActionEntity[];
}
