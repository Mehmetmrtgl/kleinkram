import { Column, Entity, JoinTable, ManyToMany, OneToMany } from 'typeorm';
import { DataType } from '../../frontend_shared/enum';
import BaseEntity from '../base-entity.entity';
import MetadataEntity from '../metadata/metadata.entity';
import ProjectEntity from '../project/project.entity';

@Entity({ name: 'tag_type' })
export default class TagTypeEntity extends BaseEntity {
    @Column()
    name!: string;

    @Column({ nullable: true })
    description?: string;

    @Column()
    datatype!: DataType;

    @ManyToMany(() => ProjectEntity, (project) => project.requiredTags)
    @JoinTable()
    project?: ProjectEntity;

    @OneToMany(() => MetadataEntity, (tag) => tag.tagType)
    tags?: MetadataEntity[];
}
