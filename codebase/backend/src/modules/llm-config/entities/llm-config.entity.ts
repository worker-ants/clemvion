// @deprecated — PR4(plan/in-progress/unified-model-management.md) 에서 제거 예정.
// chat 모델 설정은 통합 ModelConfig(kind='chat') 로 흡수됐다.
// 기존 소비자(@ManyToOne(() => LlmConfig), 타입 주석)의 무변경을 위해 re-export 유지.
// (spec/1-data-model.md §2.16 ModelConfig, spec/2-navigation/6-config.md Part B)
export {
  ModelConfig as LlmConfig,
  type ModelConfigKind,
} from '../../model-config/entities/model-config.entity';
