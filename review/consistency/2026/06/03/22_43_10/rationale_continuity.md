# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/, diff-base=origin/main)
검토 대상 파일 수: 16 (spec/ 변경 파일)

---

## 발견사항

### [WARNING] `$itemIsFirst`/`$itemIsLast` — 기존 "expression 미노출" 결정 번복, 새 Rationale 존재
- **target 위치**: `spec/4-nodes/1-logic/9-foreach.md` §3 표현식 컨텍스트 변수 목록 + `## Rationale R-1`; 연동 업데이트: `spec/5-system/4-execution-engine.md` §7.4 다이어그램, `spec/5-system/5-expression-language.md` 변수 표
- **과거 결정 출처**: `spec/4-nodes/1-logic/9-foreach.md` (origin/main) §3 주석 — "표현식 컨텍스트에 노출되는 항목 변수는 위 두 개뿐이다 (`expression-resolver.service.ts`: `$item`, `$itemIndex`). 엔진 내부 `itemContext` 는 `isFirst`/`isLast` 플래그도 보유하지만(`foreach-executor.ts`), 이는 컨테이너 실행 제어용 내부 상태이며 expression 으로 노출되지 않는다. `$item.isFirst` / `$item.isLast` 같은 first/last 플래그를 body 표현식에서 직접 읽는 surface 는 **미구현 (Planned)**"
- **상세**: 과거 결정은 isFirst/isLast 를 "expression 비노출 내부 상태"로 명시했다. target 은 `$itemIsFirst` / `$itemIsLast` top-level 변수로 노출하는 방향으로 번복하면서, **`spec/4-nodes/1-logic/9-foreach.md § Rationale R-1`** 에 번복 사유("body 표현식에서 first/last 분기 수요 확인, `$item` primitive 파괴 불가로 top-level 변수 채택, 기각된 대안 두 가지 명시")를 함께 작성했다. 연동 파일(`5-expression-language.md`, `4-execution-engine.md` 다이어그램)도 일관되게 업데이트됐다.
- **평가**: 번복 자체는 의도적이고 새 Rationale 가 동반됐으므로 절차 위반은 아니다. 다만 `execution-engine.md` 의 기존 Rationale 영역에는 이 번복에 대한 언급이 없다 — `execution-engine.md § Rationale` 엔 `isFirst`/`isLast` 미노출 근거가 별도로 기록된 적 없어 충돌 항목은 없다.
- **제안**: 현재 상태로 충분하다. INFO 보완으로 `spec/5-system/5-expression-language.md` 에 각주 수준으로 "2026-06-03 Planned → 구현 전환, 근거 foreach.md R-1" 을 삽입하면 추적성이 높아진다.

---

### [WARNING] `Use Default Output` 타입별 기본값 추론 → `null` 폴백 단일화 — 번복, 새 Rationale 존재
- **target 위치**: `spec/3-workflow-editor/1-node-common.md` §2.5.2 ("타입별 기본값" → "미지정 시 폴백") + `## Rationale R-1`; 연동: `spec/5-system/4-execution-engine.md` §4.4 처리 흐름 4번 항목
- **과거 결정 출처**: `spec/3-workflow-editor/1-node-common.md` (origin/main) §2.5.2 "타입별 기본값 (사용자가 미지정 시)" — 노드 출력 타입(Object→`{}` / Array→`[]` / String→`""` / Number→`0` / Boolean→`false`)을 마지막 정상 실행에서 추론해 자동 적용한다고 명세. §2.5.1 은 "미구현 (Planned)" 로 표기됐지만 §2.5.2 는 미구현 표기 없이 규범적 텍스트였음.
- **상세**: target 은 §2.5.2 를 "엔진은 `errorHandling.defaultOutput ?? null` 단일 폴백만 적용하며, 타입별 추론은 미구현 (Planned)" 으로 교체한다. 동시에 `## Rationale R-1` 에 교체 사유("엔진 `error-policy.handler.ts` 가 `?? null` 폴백만 구현, 타입 추론 레지스트리 별도 기능으로 Planned 유지, Reset 라벨 변경 이유")를 명시했다. `execution-engine.md` §4.4 처리 흐름 4번도 "타입별 기본값 → `null` 폴백"으로 동기화됐다.
- **평가**: 과거 §2.5.2 는 "계획 텍스트" 임에도 미구현 표기 없이 규범적으로 기술돼 있었고, 실제 구현은 `null` 단일 폴백이었다. target 은 이 불일치를 구현 현실 기준으로 교정한 것이며 새 Rationale 가 동반됐다. 절차상 문제 없다. "Reset to Type Default" → "Reset to Default" 라벨 변경도 Rationale 에 이유가 명시됐다.
- **제안**: `spec/5-system/3-error-handling.md` 에 추가된 크로스레퍼런스(`config.errorHandling.retryConfig.*` 경로) 는 1-node-common.md 와 일관성이 있다. 추가 조치 불필요.

---

### [INFO] 캔버스 요약 포맷 downscope — 미구현에서 구현 전환, 단일 포맷 통일, Rationale 존재
- **target 위치**: `spec/3-workflow-editor/0-canvas.md` §9 요약 표; `spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약; `spec/4-nodes/5-data/0-common.md` §4; `spec/4-nodes/6-presentation/0-common.md` §5; `spec/4-nodes/6-presentation/5-template.md` §7 + `## Rationale R-1`
- **과거 결정 출처**: 각 해당 문서의 "미구현 (Planned)" 표기 및 원래 포맷 명세 — Database Query `{queryType} · {쿼리 첫줄}`, Send Email `to: {수신자}`, Code `{language} · {N} lines`, Template `{outputFormat} · {N} lines` / `{N} buttons` 두 변형
- **상세**: 위 포맷들은 모두 "Planned" 로 표기된 미래 계획이었으므로 기각된 확정 결정이 아니라 잠정 명세였다. target 은 실제 구현된 summaryTemplate DSL 이 개행 카운트·배열 슬라이스를 지원하지 않아 downscope 됐음을 설명하고, 각 노드의 실제 구현 포맷으로 교체한다. Template 의 두 변형(`N lines` / `N buttons`) 단일화는 `5-template.md Rationale R-1` 에 DSL 한계 근거가 명시됐다.
- **평가**: 이전 Rationale 에 "미구현 포맷은 영구 채택" 또는 "N lines 형태를 반드시 지원한다"는 invariant 가 없었으므로 continuity 위반 없음. 단순 구현 현실 반영.
- **제안**: `0-canvas.md` §9 요약 표 각주에 "downscope 근거는 해당 노드 Rationale 참조"가 추가됐고, `0-common.md` 에도 인라인 노트가 있다. 충분하다.

---

### [INFO] `spec/conventions/spec-impl-evidence.md` 제외 범위 확장 — 구현 사실 정정, Rationale 갱신 없음
- **target 위치**: `spec/conventions/spec-impl-evidence.md` §1 제외 목록
- **과거 결정 출처**: 동일 문서 (origin/main) — "제외: `spec/0-overview.md` (cross-cutting 진입 문서)"
- **상세**: 기존 spec 은 path-specific `spec/0-overview.md` 만 제외로 표기했으나, 실제 가드 구현(`spec-frontmatter-parse.ts`)은 basename `0-overview.md` 전체(영역별 `0-overview.md` 포함)를 면제한다. target 은 이를 구현 현실에 맞춰 정정했다. 기존 Rationale (R-1~R-7) 에 "루트 한정" 의도를 명시한 항목은 없으므로 기각된 대안 재도입이 아니다. 단, 변경에 대한 새 Rationale 항이 없다.
- **평가**: 가드 구현 현실을 반영한 사실 정정이며 결정 번복이 아니다. 그러나 "왜 basename 매칭으로 넓혔는가(또는 원래 의도가 basename이었는가)" 를 짧게 문서화하면 향후 혼동을 줄일 수 있다.
- **제안**: `spec/conventions/spec-impl-evidence.md` §Rationale 에 "R-8 (또는 R-1 연장) — 0-overview.md 제외 스코프: 루트 파일 한정이 아닌 basename 매칭 (가드 구현 현실 반영)" 1 단락을 추가하면 충분하다.

---

### [INFO] `spec/0-overview.md` Integration RBAC 명시 강화 — 원칙 위반 없음
- **target 위치**: `spec/0-overview.md` §6.1 "워크스페이스 단위 Integration 공유·RBAC" 행
- **과거 결정 출처**: 동일 문서의 기존 문장 + `spec/2-navigation/4-integration.md §8` 권한 규칙 (기존 Rationale 없음)
- **상세**: 기존 문장은 `@Roles('editor')` 가드만 언급했다. target 은 "이 `editor` 는 라우트 가드 floor 이며, Organization-scope 세부 RBAC(Admin+)는 §8 + §4.2 가 SoT — 본 행과 상보 관계(모순 아님)"를 괄호 강조로 명시 추가했다. 신규 결정이 아니라 기존 RBAC 구조의 명시 보완이다.
- **평가**: 기각된 대안 재도입·합의 원칙 위반 없음.

---

## 요약

이번 변경(origin/main 대비 spec/ 16파일)의 Rationale 연속성은 전반적으로 양호하다. 두 건의 실질적 결정 번복 — (1) ForEach `$itemIsFirst`/`$itemIsLast` expression 미노출→노출 전환, (2) `Use Default Output` 타입별 기본값 추론→`null` 단일 폴백 — 은 모두 해당 파일에 새 `## Rationale` 항과 함께 기각된 대안 근거를 명시적으로 동반했다. 캔버스 요약 포맷 downscope 는 기존 Rationale 에 기록된 invariant 와 충돌하지 않는 미구현→구현 전환이다. `spec-impl-evidence.md` 의 제외 스코프 확장은 구현 사실 정정이나 새 Rationale 항이 없어 추적성이 약하다.

## 위험도

LOW
