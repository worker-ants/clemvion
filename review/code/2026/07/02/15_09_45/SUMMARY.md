# Code Review 통합 보고서 (M-7 스키마 enrich 클러스터)

대상 커밋: `875c81782` (diff-base origin/main). 파일: `resume-state.schema.ts`·`ai-turn-executor.ts`.

## 전체 위험도
**LOW** — behavior-preserving 타입 레벨 리팩터(`z.unknown()`→`z.custom<T>()` + domain 캐스트 제거). Critical 0. testing WARNING 2건(캐스트 제거 필드 non-default 회귀 가드 공백) → fix. (performance·requirement·scope 는 1차 write 유실 후 재실행 확보 — 아래.)

## Critical 발견사항
없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 조치 |
|---|----------|----------|------|
| W-1 | testing | `endMultiTurnConversation` 회귀 가드가 mcpServers/knowledgeBases 만 검증, 캐스트 제거 대상 `messages`/`turnDebugHistory`/`allPresentations` 는 non-default 값으로 미검증(`?? []` fallback 만 통과) | **FIX** — endState()에 non-default turnDebugHistory/allPresentations/messages 채운 케이스 추가, 출력 전달 단언 |
| W-2 | testing | `processMultiTurnMessage` 재개 시 turnDebugHistory/allPresentations 배열 누적(prepend+append) 로직이 미커버(resumeState() 헬퍼가 해당 키 미채움) | **FIX** — 재개 케이스에 사전 값 채우고 누적 결과 검증 |

## 참고 (INFO) — 비차단
- security×3: z.custom<T>() predicate 없으면 no-op(기존 z.unknown()과 동일 강도), credential allow-list 불변, state as ResumeState 는 캐스트 위치 이동뿐 — 조치 불필요
- architecture×3: 레이어 경계·순환 의존 없음, `const resumeState` 반복은 의도된 boundary(선택: narrowResumeState 헬퍼), type-only import — 조치 불필요
- side_effect×2: 시그니처·영속 스키마·전역상태·I/O 불변 — 조치 불필요
- maintainability×2: state/resumeState 공존 혼용 주의·스키마 주석 3중 반복 — 경미
- documentation×3: z.custom 무검증 계약 문서화 모범, 잔존 캐스트 근거 구분 명확, README/CHANGELOG 불요
- INFO(2440 legacy `as ChatMessage[]`)·INFO(z.custom 무검증 계약 고정 테스트)·INFO(z.custom 스타일 혼재 원소단위 vs 배열단위) — 후속/선택

## 에이전트별 위험도

| 에이전트 | 위험도 | 핵심 |
|----------|--------|------|
| security | NONE | 순수 타입, credential-strip 불변, 신뢰 경계 변화 없음 |
| architecture | NONE | 경계·순환의존 없음, boundary 캐스트 의도 |
| side_effect | NONE | 시그니처/영속/전역/I/O 불변 |
| maintainability | NONE | 가독성 개선, 주석 반복 경미 |
| testing | LOW | non-default 회귀 가드 공백 W-1/W-2 → fix |
| documentation | NONE | 문서화 우수 |
| performance | NONE (재실행 확보) | 타입만 변경, 알고리즘/IO 무관 |
| requirement | NONE (재실행 확보) | spec §7.4/§7.9 shape 불변, 타입 정합 |
| scope | NONE (재실행 확보) | plan §M-7 enrich 범위 일치 |

## 권장 조치사항
1. W-1/W-2 회귀 테스트 추가(fix).
2. performance/requirement/scope 재실행(커버리지).
3. (선택) z.custom 무검증 계약 고정 테스트·2440 legacy 캐스트 후속 통일.

## 라우터 결정
실행 9명(security/performance/architecture/requirement/scope/side_effect/maintainability/testing/documentation), 제외 5명(dependency/database/concurrency/api_contract/user_guide_sync — 무관).
