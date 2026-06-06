# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/embedding-model-ux.md`
검토 모드: `--impl-prep` (구현 착수 전)
관련 spec Rationale: `spec/5-system/7-llm-client.md §Rationale`, `spec/5-system/8-embedding-pipeline.md §Rationale`, `spec/2-navigation/5-knowledge-base.md §Rationale`, `spec/2-navigation/6-config.md §Rationale R-1`

---

## 발견사항

### [WARNING] embed 시그니처 확장이 spec §3.3 의 "평탄한 시그니처" 결정을 번복하면서 새 Rationale 없음

- **target 위치**: `plan/in-progress/embedding-model-ux.md` — D-P6-3, Phase A `interfaces/llm-client.interface.ts` 항목
- **과거 결정 출처**: `spec/5-system/7-llm-client.md §3.3 embed 시그니처`
  - 현재 spec 본문: `embed(texts: string[], model?: string): Promise<number[][]>`
  - 주석: "임베딩은 파라미터/응답 객체를 쓰지 않고 **평탄한 시그니처**를 사용한다."
  - 추가 note: "`EmbedResponse` 형태는 현재 미구현(Planned). 사용량 로깅이 필요한 임베딩 경로는 별도 토큰 추정에 의존한다." — 즉 파라미터 객체화를 Planned 로 열어두기보다 '현재 채택하지 않는다'는 보수적 입장을 명시.
- **상세**: plan D-P6-3 은 `embed(texts, model?, inputType?: 'query'|'document')` 로 세 번째 위치 인자를 추가한다. 이는 기존 "평탄한 시그니처" 방향성을 이어가지만, spec §3.3 본문이 이 형태를 채택한 이유(파라미터 객체 vs 위치 인자, Planned EmbedResponse 와의 관계)에 대한 Rationale 이 spec 에 없다. 향후 `EmbedResponse` 파라미터 객체 형태로 진화할 때 `inputType` 위치 인자가 충돌 지점이 될 수 있다. 또한 spec 갱신 예정(`8-embedding-pipeline.md §5`)에는 `inputType` 파라미터가 포함되어 있으나 `7-llm-client.md §3.3` 의 시그니처 갱신은 plan 의 spec 갱신 대상에 명시되지 않아 spec 간 불일치가 발생할 수 있다.
- **제안**:
  1. `spec/5-system/7-llm-client.md §3.3` 를 spec 갱신 범위에 포함해 시그니처를 `embed(texts: string[], model?: string, inputType?: 'query' | 'document'): Promise<number[][]>` 로 갱신하고, "위치 인자 확장 채택, 파라미터 객체화는 EmbedResponse 도입 시까지 보류" 를 해당 파일의 `## Rationale` 에 명시.
  2. 또는 spec 갱신 phase(Phase A 마지막 항목)에 `7-llm-client.md §3.3` 도 명시적으로 포함.

---

### [WARNING] Phase B 한국어 추천 배지가 select-only 원칙(R-1)과의 관계를 명시하지 않음

- **target 위치**: `plan/in-progress/embedding-model-ux.md` — D-P6-5, Phase B 항목 (`embedding-model-combobox.tsx` 한국어 추천 배지)
- **과거 결정 출처**: `spec/2-navigation/5-knowledge-base.md §Rationale R-1` + `spec/2-navigation/6-config.md §Rationale R-1`
  - "KB 생성·설정 폼의 임베딩 모델 입력은 select-only 로 강제한다."
  - "자유 텍스트 입력은 허용하지 않는다. 미로드 / 조회 실패 시 select 비활성, 에러 메시지만 표시."
  - 근거: 잘못된 모델 ID 저장 시 KB 임베딩 전체 손상. select 강제의 보호 효과가 chat 모델보다 더 큼.
- **상세**: plan D-P6-5 는 "비강제(선택 자유)" 라고 명시하며, combobox 에 "한국어 추천" 배지/힌트를 추가한다. 이는 select 의 기존 옵션 위에 추가 메타데이터를 표시하는 것으로 select-only 원칙을 직접 위반하지는 않는다. 그러나 "비강제" 라는 표현이 select-only 원칙(자유 입력 미허용)과 충돌하지 않는다는 점을 명시하지 않으면 구현자가 자유 입력 경로를 허용하는 것으로 오독할 수 있다. 또한 기존 구현에서 컴포넌트가 `EmbeddingModelCombobox` 로 명명된 점("Combobox" 는 일반적으로 자유 입력+목록 조합)도 혼동 요소가 된다.
- **제안**: plan Phase B 에 "select-only 원칙(R-1) 유지 — 배지는 기존 select 옵션 위에 표시 메타데이터만 추가하며, 자유 입력 경로를 열지 않는다" 한 줄 추가. spec 갱신 시 `5-knowledge-base.md §Rationale R-1` 에도 "배지/힌트 패턴은 select-only 원칙 안에서 허용" 을 보완.

---

### [INFO] D-P6-4 재임베딩 비대칭 경고와 기존 Rationale "모델 변경 = 재임베딩 필요" 항의 관계 보완 가능

- **target 위치**: `plan/in-progress/embedding-model-ux.md` — D-P6-4
- **과거 결정 출처**: `spec/5-system/8-embedding-pipeline.md §Rationale "결정: 다중 차원 임베딩 + KB 단위 모델 선택"` — "모델 변경 정책: 변경 허용 + 수동 KB 단위 재임베딩 버튼"
- **상세**: 기존 Rationale 은 "임베딩 모델 변경 → 전체 재임베딩 필요" 를 채택한 배경을 기술하지만, 변경 전 색인된 청크가 `input_type` 없이 임베딩되어 비대칭이 발생하는 새 케이스는 다루지 않는다. plan D-P6-4 가 이 비대칭 케이스를 식별하고 "재임베딩 권고" 를 추가하는 것은 기존 결정의 확장이므로 Rationale 충돌은 없다. 다만 spec 갱신(`8-embedding-pipeline.md §5`) 시 기존 Rationale 의 "재임베딩 정책" 항을 함께 갱신해 "prefix/taskType 도입 후 기존 색인의 비대칭 발생" 케이스를 포함시키면 Rationale 완전성이 높아진다.
- **제안**: Phase A spec 갱신 시 `8-embedding-pipeline.md §Rationale` 의 기존 "재임베딩 필요" 항에 "input_type prefix/taskType 배선 변경 시 기존 색인 비대칭" 내용을 보완 기술 추가.

---

## 요약

plan 의 핵심 설계(D-P6-1 ~ D-P6-5)는 기존 spec Rationale 의 확립된 결정들(select-only 임베딩 모델, 재임베딩 정책, 비동기 BullMQ 큐, 추상 LLMClient 인터페이스)과 정면 충돌하지 않는다. 다만 두 건의 WARNING 이 식별됐다. 첫째, `embed` 시그니처에 `inputType` 위치 인자를 추가하는 D-P6-3 이 spec 에서 "평탄한 시그니처" 로 고정된 `7-llm-client.md §3.3` 를 변경하면서, 해당 spec 파일이 plan 의 갱신 대상에 누락되어 있고 새 Rationale 도 부재하다. 둘째, Phase B 의 한국어 추천 배지가 "비강제" 로 기술되는데, select-only 원칙(R-1)과의 관계가 명시되지 않아 구현 시 자유 입력 허용 여부에 대한 혼동 여지가 있다. 두 건 모두 spec 갱신 범위 보완과 Rationale 한 줄 추가로 해소 가능하며, 구현을 차단할 Critical 수준은 아니다.

## 위험도

LOW
