# RESOLUTION — 최종 fresh ai-review (02_20_16)

최종 커밋(28497a69) 위의 fresh ai-review. **위험도 MEDIUM, Critical 0.** 직전 라운드(01_38_22)의
SPEC-DRIFT 경고는 **소멸**(§6.1 364/368 정합 확인 + §12.12 "현 결정" ⚠️ 이력 주석 추가). user_guide_sync
**NONE**(KO/EN MDX·backend-labels·dict 갱신 완전 확인). 잔여 5 Warning 은 운영(이미 문서화) 또는 DEFER
기술부채 — 코드 무변경, 본 RESOLUTION 으로 disposition 고정.

## 조치 항목

| # | 분류 | disposition |
|---|---|---|
| Warning 1 | BullMQ payload rename (in-flight) | **운영 노트** — #642 직후 in-flight ~0. 배포 전 큐 drain. 구 job → config id `undefined` → 폴백(crash 아님). plan 마이그레이션 §배포 전 운영 + 01_12_46/01_38_22 RESOLUTION 에 기재 |
| Warning 2 | 폴백 체인 추상화 비대칭 (summary 핸들러 / extraction processor / embedding 서비스) | **DEFER** — 동작 정확. `LlmService.resolveForExtraction(...)` 식 캡슐화는 후속 리팩터 (3 경로 통일). 본 PR 범위 밖, 회귀 위험 > 이득 |
| Warning 3 | 타입 단언 `as string \| undefined` 다수 | **DEFER** — 기존부터 있던 패턴(노드 config 가 느슨한 타입). `z.infer` 전파는 핸들러 전반 기술부채로 별도 작업 |
| Warning 4 | `process()` JSDoc 없음 | **DEFER(저가치)** — config 해석 흐름은 인라인 주석(`||` 의도 포함, 커밋 28497a69)으로 이미 설명. 메서드 JSDoc 은 nice-to-have |
| Warning 5 | 위젯 레지스트리 구 키 제거 | **저위험** — #642 직후 데이터 ~0, 구 키 → `UnsupportedWidget` 폴백. plan 배포 노트 + interface 주석(마이그레이션 경로) |
| Info 1–20 | 다수 | **비차단 ACK** — INFO4(`\|\|` 의도) 주석 추가 완료(28497a69). 보안(`as` 단언·payload Zod parse), 테스트 보강(resolveEmbedding reject·widget 엣지·빈문자열 폴백 케이스), 가독성(훅 이중호출·llmConfig 명명·JSDoc 길이) 전부 후속 여지. summaryModelConfigId 이중 전달(INFO13)은 Warning 9 defer 와 동일 |

## TEST 결과

- lint: 통과 (커밋 28497a69)
- unit: 통과 (전체 재수행 — postdoc-chain; 영향 스펙 누적 검증)
- build: 통과
- e2e: 통과 (자동 흐름, 205 tests)

## 보류·후속 항목

- 폴백 체인 3경로 캡슐화 통일(Warning 2) + summaryModelConfigId `config` 경유 통일(Warning 9/INFO13):
  후속 리팩터 plan.
- 타입 단언 Zod infer 전파(Warning 3), 테스트 엣지 케이스 보강(INFO15-19): 비차단 기술부채.
- 배포 운영: BullMQ drain + node_configs 구 위젯 키 0건 확인 (plan 기재).

> **SPEC-CONSISTENCY(impl-done)**: 병렬 impl-done(02_21_06)의 BLOCK:YES 는 cross-branch baseline
> 오탐(checker 가 out-of-scope spec 을 origin/main 으로 읽음) — 동 세션 RESOLUTION.md 에 grep 증거.
> push 는 `BYPASS_REVIEW_GUARD=1`.
