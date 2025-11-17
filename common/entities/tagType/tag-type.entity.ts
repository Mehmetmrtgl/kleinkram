import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { DataType } from '../../frontend_shared/enum';
import BaseEntity from '../base-entity.entity';
import MetadataEntity from '../metadata/metadata.entity';
import Project from '../project/project.entity';

@Entity()
export default class TagType extends BaseEntity {
    @Column()
    name!: string;

    @Column({ nullable: true })
    description?: string;

    @Column()
    datatype!: DataType;

    @ManyToMany(() => Project, (project) => project.requiredTags)
    @JoinTable()
    project?: Project;

    @OneToMany(() => MetadataEntity, (tag) => tag.tagType)
    tags?: MetadataEntity[];
}
