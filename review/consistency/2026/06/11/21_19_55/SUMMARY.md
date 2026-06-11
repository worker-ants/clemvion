# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

대상: `spec/4-nodes/5-data/2-code.md`
검토일: 2026-06-11
세션: `review/consistency/2026/06/11/21_19_55/`

---

## 전체 위험도

**HIGH** — 사용자 공개 문서의 에러 코드·허용 API 기술이 spec 과 정면 충돌하며, draft 내부에 구버전 `vm.Script` 표현이 2곳에 잔류해 단일 진실 원칙이 깨진 상태.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| C-1 | naming_collision | `EXECUTION_TIMEOUT` / `CODE_RUNTIME_ERROR` 가 사용자 공개 문서에서 정식 에러 코드로 안내되지만 target spec 은 이를 `legacyCode` 로 격하 — 워크플로우 `error` 포트 분기가 런타임 불일치 유발. 추가로 `CODE_SYNTAX_ERROR` 는 spec·구현 어디에도 정의되지 않은 허상 코드 | §5.3 에러 코드 정규화 표 | `codebase/frontend/src/content/docs/02-nodes/data.mdx` L124–125, `data.en.mdx` L113–114 | `data.mdx`/`data.en.mdx` 에러 코드 표를 `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` 세 코드로 교체. `CODE_SYNTAX_ERROR` 행 제거 |
| C-2 | convention_compliance | §5 인트로 박스에 `vm.Script 구문 오류` 잔류 — §4·§7 `isolated-vm` 기술과 직접 충돌 | §5 출력 구조 인트로 (~줄 136) | draft 내부 §4·§7 (`isolated-vm isolate compileScript`) | `(vm.Script 구문 오류)` → `(isolate compileScript 구문 오류)` 로 교체 |
| C-3 | convention_compliance | §6 Pre-flight 표 마지막 행의 `vm.Script` 잔류 — §4·§7 과 불일치 | §6 표 마지막 행 | draft 내부 §4·§7 | `vm.Script` → `isolated-vm isolate compileScript` 로 교체. §5 와 동일하게 갱신 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | cross_spec | `EXECUTION_TIMEOUT` 코드 지위 충돌 — target 은 `legacyCode` 로 격하했으나 4개 spec 이 여전히 정식 코드로 취급 | §5.3.2 타임아웃 케이스 + 에러 코드 매핑 표 | `spec/5-system/3-error-handling.md` §1.4, `spec/5-system/4-execution-engine.md:1018/1398`, `spec/5-system/14-external-interaction-api.md:547`, `spec/conventions/chat-channel-adapter.md:387` | `3-error-handling.md` §1.4 를 `CODE_TIMEOUT`(정식) / `EXECUTION_TIMEOUT`(deprecated legacyCode) 로 분리; 나머지 3개 문서를 `CODE_TIMEOUT` 으로 일괄 갱신 |
| W-2 | cross_spec | `CODE_RUNTIME_ERROR` / `EXECUTION_MEMORY_EXCEEDED` legacyCode 가 타 spec 에 미등재 | §5.3 에러 코드 매핑 표 | `spec/5-system/3-error-handling.md` §1.4, `spec/conventions/chat-channel-adapter.md:387,388` | `3-error-handling.md` §1.4 Code 노드 행 주석에 legacyCode 매핑 추가 또는 target §5.3 에 "핸들러 내부 전용" 명시 |
| W-3 | convention_compliance | §5.3 공통 필드 표 헤딩 번호 중복 — `§5.3` 이 두 번 사용되어 anchor slug 충돌 가능 | `#### 5.3 공통 필드 표` 섹션 (~줄 313) | `spec-link-integrity.test.ts` slug 가드 | 공통 필드 표를 `### 5.4 에러 케이스 공통 필드` 또는 `#### 공통 필드 (모든 에러 케이스)` 로 개명·격하 |
| W-4 | convention_compliance | §8 캔버스 요약 인라인 서술이 `0-common.md §3` SoT 보다 장황 — 단일 진실 원칙 희석 | §8 캔버스 요약 (~줄 415) | `spec/4-nodes/5-data/0-common.md §3` | `[Data 공통 §3](./0-common.md#3-캔버스-요약) — Code 행 인용.` 으로 단순화 |
| W-5 | convention_compliance | §5.1 `meta.success` Principle 2 anchor 링크의 slug 정확성 미검증 — 실제 slug 다를 경우 `spec-link-integrity.test.ts` 빌드 가드 실패 | §5.1 표 `meta.success` 행 링크, §5.3 동일 패턴 | `spec/conventions/node-output.md` Principle 2 heading | `node-output.md` Principle 2 heading 의 정확한 GitHub slug 확인 후 anchor 보정 |
| W-6 | convention_compliance | §5.3.3 JSON 예시에 `meta.durationMs` 누락 — `node-output.md Principle 2` 공통 필수 필드 | §5.3.3 메모리 초과 JSON 예시 | `spec/conventions/node-output.md Principle 2` | `"durationMs": 0` 추가 또는 "isolate 즉시 폐기 시 durationMs 는 0" 명시 |
| W-7 | convention_compliance | §5.3 공통 필드 표의 `output.error.code` 열거에 `CODE_MEMORY_LIMIT` 누락 | §5.3 공통 필드 표 `output.error.code` 행 | draft §5.3.3 + 에러 코드 정규화 매핑 표 | `output.error.code` 행을 `CODE_TIMEOUT / CODE_EXECUTION_FAILED / CODE_MEMORY_LIMIT` 로 확장 |
| W-8 | naming_collision | user-docs 가 `setTimeout` 을 "최대 5초 허용 전역"으로 안내 — target spec §7.3 은 부트스트랩에서 삭제하는 차단 항목으로 분류 | §7.3 차단 API 표 | `data.mdx` L114, `data.en.mdx` L103 | `data.mdx`/`data.en.mdx` 의 허용 전역 목록에서 `setTimeout` 제거, `Promise`/`async/await` 비동기 처리 안내로 대체 |
| W-9 | plan_coherence | `refactor/04-security.md` C-2 체크박스가 `- [ ] 결정 대기 (사용자)` 로 남아있어 plan↔spec 불일치 | spec §7.1 + Rationale "격리 방식 isolated-vm 전환 결정 (2026-06-11)" | `plan/in-progress/refactor/04-security.md` C-2 + README.md `04 C-2` 행 | C-2 를 `- [x] ✅ 사용자 결정 완료 (2026-06-11, isolated-vm 전환 확정)` 로 갱신, README.md `04 C-2` 행 ✅ 마킹. `project-planner` 수행 |
| W-10 | plan_coherence | `node-output-redesign/code.md` 의 "로드맵 미구현" / `CODE_MEMORY_LIMIT /* 로드맵 */` 서술이 target spec(현재 구현) 과 충돌 | spec §5.3.3, §7.1, §7.2 | `plan/in-progress/node-output-redesign/code.md` §구현 분석 §8 | "2026-06-11 전환 완료"로 최신화 또는 "과거 시점 기준 분석" 명시. `developer` 또는 `project-planner` 수행 |

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | cross_spec | `spec/4-nodes/0-overview.md §5` 타임아웃 관련 문구 — 현재 충돌 없으나 W-1 해소 시 연동 검토 필요 | `spec/4-nodes/0-overview.md:301` | W-1 해소 작업 시 함께 확인 |
| I-2 | cross_spec | `0-common.md §4.1` Code 행 에러 포트 열에 구체 코드명 미기재 | `spec/4-nodes/5-data/0-common.md §4.1` | `CODE_TIMEOUT / CODE_EXECUTION_FAILED / CODE_MEMORY_LIMIT` 를 brief reference 로 추가 권장 |
| I-3 | convention_compliance | §4 실행 로직에서 `isolated-vm` 포워드 참조(§7.1) 링크 부재 — 독자 진입성 문제 | §4 step 3 | `"isolated-vm 격리 방식은 §7.1 참조"` 인라인 링크 추가 |
| I-4 | convention_compliance | §5.1 `meta.success` 와 §5.3 `meta.success` 의 Principle 2 참조 방식 불일치 (링크 유/무) | §5.1 표 vs §5.3 표 | 두 행을 동일한 참조 방식으로 통일 |
| I-5 | convention_compliance | frontmatter `status: implemented` — isolated-vm 전환이 구현 파일에 아직 미반영이라면 `status: partial` 이 더 정확 | frontmatter `code:` | 구현 파일 전환 여부 확인 후 `status` 갱신 |
| I-6 | naming_collision | `error-codes.md §3` historical-artifact 레지스트리에 legacy 코드 3건 매핑 미등록 | `spec/conventions/error-codes.md §3` | `EXECUTION_TIMEOUT → CODE_TIMEOUT`, `CODE_RUNTIME_ERROR → CODE_EXECUTION_FAILED`, `EXECUTION_MEMORY_EXCEEDED → CODE_MEMORY_LIMIT` 항목 추가 |
| I-7 | plan_coherence | `refactor/04-security.md` M-2 체크박스 미갱신 (C-2 isolated-vm 전환 시 흡수 완료) | `plan/in-progress/refactor/04-security.md` M-2 | `- [x] ✅ C-2 isolated-vm 전환 시 흡수 완료 (2026-06-11)` 로 갱신. `project-planner` 수행 |
| I-8 | plan_coherence | `marketplace-and-plugin-sdk.md` 의 isolated-vm "로드맵" 참조가 구식 (현재 구현으로 변경됨) | `plan/in-progress/marketplace-and-plugin-sdk.md` | "code 노드는 isolated-vm 기전환(§7.1), 마켓플레이스 외부 노드는 별도 sandbox 설계 필요"로 업데이트 |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | MEDIUM | `EXECUTION_TIMEOUT` 코드 지위 충돌이 4개 spec 에 걸쳐 미해소; legacyCode 2건 타 spec 미등재 |
| rationale_continuity | NONE | 기각된 대안 재도입 없음, 합의 원칙 전면 준수, `node:vm → isolated-vm` 번복 Rationale 완비 |
| convention_compliance | MEDIUM | draft 내 `vm.Script` 2곳 잔류(CRITICAL), `meta.durationMs` 누락, 섹션 번호 충돌, anchor slug 미검증 |
| plan_coherence | MEDIUM | `refactor/04-security.md` C-2 결정 대기 체크박스 미갱신, `node-output-redesign/code.md` 로드맵 서술 충돌 |
| naming_collision | HIGH | 사용자 공개 문서의 에러 코드 / `setTimeout` 허용 기술이 spec 과 정면 충돌 — 런타임 오작동 위험 |

---

## 권장 조치사항

1. **(BLOCK 해소 우선 — C-1)** `codebase/frontend/src/content/docs/02-nodes/data.mdx` 및 `data.en.mdx` 에러 코드 표를 `CODE_TIMEOUT` / `CODE_EXECUTION_FAILED` / `CODE_MEMORY_LIMIT` 로 교체, `CODE_SYNTAX_ERROR` 행 제거, `setTimeout` 허용 전역 항목 제거(W-8 병행). `developer` 수행.
2. **(BLOCK 해소 우선 — C-2, C-3)** draft `spec/4-nodes/5-data/2-code.md` §5 인트로 박스 및 §6 표의 `vm.Script` 표현 2곳을 `isolated-vm isolate compileScript` 로 교체. `project-planner` 수행.
3. **(W-1, W-2 연계 — spec 4개 문서 갱신)** `spec/5-system/3-error-handling.md`, `spec/5-system/4-execution-engine.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/chat-channel-adapter.md` 의 `EXECUTION_TIMEOUT` 참조를 `CODE_TIMEOUT`(정식) / `EXECUTION_TIMEOUT`(legacyCode deprecated) 구조로 갱신. `project-planner` 수행.
4. **(W-3, W-6, W-7)** draft §5.3 공통 필드 표 헤딩 개명, §5.3.3 `meta.durationMs` 추가, `output.error.code` 열거에 `CODE_MEMORY_LIMIT` 추가. `project-planner` 수행.
5. **(W-9, I-7)** `plan/in-progress/refactor/04-security.md` C-2, M-2 체크박스를 완료 상태로 갱신, README.md `04 C-2` 행 ✅ 마킹. `project-planner` 수행.
6. **(I-6)** `spec/conventions/error-codes.md §3` 에 legacy 코드 3건 매핑 등록. `project-planner` 수행.
7. **(W-5)** `node-output.md` Principle 2 heading 의 정확한 GitHub slug 확인 후 draft §5.1/§5.3 anchor 보정. `project-planner` 수행.
8. **(W-4, I-2, I-3, I-4, I-8)** 나머지 정합성·문서 품질 개선 항목은 BLOCK 해소 후 후속 작업으로 처리.