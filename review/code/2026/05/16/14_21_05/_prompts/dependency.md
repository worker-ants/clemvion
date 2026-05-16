# 의존성(Dependency) Review Payload

본 파일은 orchestrator 가 의존성(Dependency) reviewer 용으로 작성한 입력입니다. 다음 코드 변경을 의존성 관점에서 분석한다.
sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.

## 점검 관점 (의존성(Dependency))

1. **새 의존성**: 새 외부 패키지/라이브러리 추가 여부와 필요성
2. **버전 고정**: 의존성 버전 고정(pinning) 여부
3. **라이선스**: 새 의존성의 라이선스가 프로젝트와 호환되는지
4. **취약점**: 알려진 보안 취약점이 있는 의존성 사용 여부
5. **불필요한 의존성**: 표준 라이브러리·기존 의존성으로 대체 가능한지
6. **의존성 크기**: 번들 크기·빌드 시간 영향
7. **호환성**: 기존 의존성과의 버전 충돌·호환성
8. **내부 의존성**: 프로젝트 내부 모듈 간 의존 관계

## 리뷰 대상 파일

### 파일 1: review/consistency/2026/05/16/12_24_55/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/12_24_55/naming_collision/review.md b/review/consistency/2026/05/16/12_24_55/naming_collision/review.md
new file mode 100644
index 00000000..6efaeba4
--- /dev/null
+++ b/review/consistency/2026/05/16/12_24_55/naming_collision/review.md
@@ -0,0 +1,33 @@
+# 신규 식별자 충돌 검토 결과
+
+검토 대상: `plan/in-progress/spec-draft-data-model-install-token-followup.md`
+검토 파일: `spec/1-data-model.md` §2.10 (`install_token`, `install_token_issued_at` 컬럼 설명 정정)
+
+---
+
+### 발견사항
+
+충돌 발견 없음.
+
+본 변경은 두 기존 컬럼(`install_token`, `install_token_issued_at`)의 **설명 문구만 정정**하며, 신규 식별자(필드명, 엔티티명, API endpoint, 이벤트명, 환경변수, 파일 경로)를 전혀 도입하지 않는다.
+
+점검 관점별 결과는 다음과 같다.
+
+1. **요구사항 ID 충돌** — target이 새로 부여하는 요구사항 ID 없음. 해당 없음.
+2. **엔티티/타입명 충돌** — 신규 엔티티·DTO·인터페이스 도입 없음. 해당 없음.
+3. **API endpoint 충돌** — 신규 endpoint 없음. 해당 없음.
+4. **이벤트/메시지명 충돌** — 신규 이벤트·메시지 이름 없음. 해당 없음.
+5. **환경변수·설정키 충돌** — 신규 환경변수·설정키 없음. 해당 없음.
+6. **파일 경로 충돌** — 기존 `spec/1-data-model.md`를 수정하는 것이며, 신규 spec 파일을 생성하지 않음. 해당 없음.
+
+추가로 정정 방향의 정합성도 확인하였다. `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 항(line 969)이 "callback 성공 시 `install_token` 과 `install_token_issued_at` 모두 **보존**된다 (2026-05-16 갱신)"고 이미 명시하고 있으며, 같은 파일 line 599에서도 `pending_install → connected` 전이 시 `install_token` 보존 정책이 기술되어 있다. target이 정정하려는 `spec/1-data-model.md` line 253-254의 "callback 성공 또는 TTL 만료 시 NULL" 표현은 이 정책과 어긋나는 잔존 문구이며, 정정 내용이 코퍼스 전반과 일치한다. 충돌이 아닌 일관성 회복이다.
+
+---
+
+### 요약
+
+본 변경(`spec/1-data-model.md §2.10` `install_token`·`install_token_issued_at` 설명 정정)은 신규 식별자를 전혀 도입하지 않는 순수 문구 정정이다. 새 필드명·엔티티명·API 경로·이벤트명·환경변수·파일 경로가 없으므로 식별자 충돌은 발생하지 않는다. 정정 방향 자체도 `spec/2-navigation/4-integration.md` 및 `spec/data-flow/integration.md`의 정책과 완전히 일치한다. 신규 식별자 충돌 관점에서 차단 또는 주의 사항이 없다.
+
+### 위험도
+
+NONE

```

---

### 파일 2: review/consistency/2026/05/16/12_24_55/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/12_24_55/plan_coherence/review.md b/review/consistency/2026/05/16/12_24_55/plan_coherence/review.md
new file mode 100644
index 00000000..a64699a6
--- /dev/null
+++ b/review/consistency/2026/05/16/12_24_55/plan_coherence/review.md
@@ -0,0 +1,52 @@
+# Plan 정합성 Review
+
+검토 대상: `plan/in-progress/spec-draft-data-model-install-token-followup.md`
+검토 모드: spec draft (--spec)
+검토 일시: 2026-05-16
+검토 worktree: `cafe24-app-url-detail-a7c3f4`
+
+---
+
+### 발견사항
+
+- **[WARNING]** `spec/data-flow/integration.md §1.2.1` line 90 미정정 — target 이 "이미 반영됨" 으로 참조하나 실제로는 구 정책 잔존
+  - target 위치: 본문 "정합성" 절 — "`spec/data-flow/integration.md §1.2.1` line 90" 을 새 정책 근거로 인용
+  - 관련 plan: 없음 (미추적 drift)
+  - 상세: target plan 은 "본 변경은 이미 머지된 두 spec 의 정책과 완전 일치" 하며 `spec/data-flow/integration.md §1.2.1` line 90 을 그 근거로 든다. 그러나 실제 해당 줄은 아직 `UPDATE integration SET status=connected, install_token=NULL, ...` 로 기록되어 있어 callback 성공 시 install_token 을 **소거** 하는 구 정책을 그대로 나타낸다. 새 persistent 정책(callback 성공 시 보존)이 해당 파일에 반영되지 않은 상태다.
+  - 제안: `spec/data-flow/integration.md §1.2.1` line 90 의 mermaid sequence diagram 을 함께 정정하거나, 이를 별도 follow-up plan 항목으로 명시해야 한다. 현재 target plan 의 "정합성" 절은 근거가 부정확하므로 해당 줄 인용을 제거하거나 "아직 잔존 drift, 추가 정정 필요" 로 수정해야 한다.
+
+- **[WARNING]** `spec/2-navigation/4-integration.md` Rationale "TTL 기준" 단락 내 callback 성공 NULL 문장 미정정
+  - target 위치: 본문 "정합성" 절 — "`spec/2-navigation/4-integration.md` Rationale 'install_token TTL 24h'" 를 새 정책 근거로 인용
+  - 관련 plan: 없음 (미추적 drift)
+  - 상세: `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 단락의 "TTL 기준 (2026-05-15 갱신)" 문단 말미에 "callback 성공 시 `install_token` 과 함께 `install_token_issued_at` 도 NULL 로 비워진다." 가 잔존한다. 동 문서의 §6 상태 전이 표(line 598)와 §3.2(line 188)는 install_token 보존 정책을 명시하고 있어 같은 파일 내부에서 모순이 발생한다. target plan 은 이 단락을 정합 근거로 인용하나, 해당 단락은 구 정책 문장을 포함한다.
+  - 제안: `spec/2-navigation/4-integration.md` Rationale TTL 기준 단락의 "callback 성공 시 ... NULL 로 비워진다" 문장을 target plan 변경 범위에 포함하거나, 별도 follow-up 항목으로 추가해야 한다. 인용 근거도 "§6 상태 전이 표 / §3.2 / §9.2" 등 올바른 줄로 교정이 필요하다.
+
+- **[WARNING]** `cafe24-data-model-strengthen.md` plan 의 구현 체크박스가 구 정책(callback 성공 시 NULL)을 기반으로 완료 처리됨
+  - target 위치: 없음 (plan 간 관계)
+  - 관련 plan: `plan/in-progress/cafe24-data-model-strengthen.md` (worktree: `cafe24-data-model-strengthen-464de9`, 현재 worktree 미존재) — 단계 "결정 3" 체크박스 `handleCallback` 성공 분기: `installTokenIssuedAt = null` 로 install_token 과 함께 클리어
+  - 상세: `cafe24-data-model-strengthen.md` 는 "handleCallback 성공 시 `installTokenIssuedAt=null` 클리어" 를 구현·테스트 모두 완료(✅) 처리했다. 해당 worktree 는 이미 소멸(merge 추정)했으므로 코드에 구 정책이 반영된 상태일 수 있다. target plan 이 `spec/1-data-model.md §2.10` 설명을 "callback 성공 시 보존"으로 정정하더라도 실제 백엔드 코드(`integration-oauth.service.ts` 의 `handleCallback`)가 아직 `installTokenIssuedAt = null` 로 동작한다면 spec ↔ 구현 간 새로운 drift 가 발생한다. 테스트(`integration-oauth.service.spec.ts`) 도 구 정책을 기준으로 작성되어 있어 spec 정정 이후 회귀 기준이 어긋난다.
+  - 제안: target plan 에 "spec 정정 후 backend `handleCallback` 에서 `installTokenIssuedAt` 보존 처리로 변경 + 관련 테스트 갱신" 을 후속 항목으로 명시해야 한다. 아니면 별도 developer plan 을 생성해 구현을 spec 과 재동기화해야 한다.
+
+- **[INFO]** `cafe24-pending-polish-followup.md` 내 미해결 항목과 부분 중복
+  - target 위치: 없음 (plan 간 관계)
+  - 관련 plan: `plan/in-progress/cafe24-pending-polish-followup.md` — "§6 mermaid `install_token` 보존 정책 명시 (callback 실패 시 install_token 유지)" 항목 미완료(`[ ]`)
+  - 상세: `cafe24-pending-polish-followup.md` 는 §6 mermaid 의 install_token 보존 정책 명시를 별도 미완 항목으로 추적 중이다. target plan 이 `spec/1-data-model.md §2.10` 을 정정하면 이 followup 항목과 관련된 인접 정책 구역이 함께 갱신되어야 일관성이 유지된다. 직접 충돌은 아니나, target plan 완료 후 해당 followup 항목이 여전히 미완으로 남으면 두 문서 간 gap 이 지속된다.
+  - 제안: target plan 완료 후 `cafe24-pending-polish-followup.md` 의 §6 항목을 re-assess 하여 여전히 유효한지, 또는 target plan 의 정정으로 커버됐는지 확인하고 체크박스를 갱신한다.
+
+- **[INFO]** worktree 단독 점유 — 다른 활성 worktree 와 `spec/1-data-model.md §2.10` 동시 접근 없음
+  - target 위치: frontmatter `worktree: cafe24-app-url-detail-a7c3f4`
+  - 관련 plan: 해당 섹션을 현재 활성 수정 중인 다른 in-progress plan 없음
+  - 상세: `cafe24-data-model-strengthen-464de9` worktree 는 이미 소멸. `cafe24-3rdparty-url-503aa0`, `cafe24-pending-polish-7fdb7e` 등 관련 worktree 도 소멸. `spec-update-impl-prep-findings.md`(worktree: `ai-thread-source-mark-7c4f2a`) 는 `spec/1-data-model.md §2.13` 만 다뤄 §2.10 과 겹치지 않는다. 현재 `cafe24-app-url-detail-a7c3f4` 가 `spec/1-data-model.md §2.10` 에 단독 접근하므로 worktree 경합 위험은 없다.
+  - 제안: 추적 메모 — 이후 backend 구현 worktree 가 `handleCallback` 을 수정할 때 동일 영역 경합이 생길 수 있으므로, 해당 시점에 plan frontmatter 를 갱신하고 직렬화를 확인한다.
+
+---
+
+### 요약
+
+target plan 은 `spec/1-data-model.md §2.10` 의 install_token / install_token_issued_at 컬럼 설명을 "callback 성공 시 NULL" 에서 "callback 성공 시 보존"으로 정정하는 순수 drift-fix 작업으로, 새 정책 도입 없이 이미 머지된 정책을 반영한다는 점에서 범위는 적절하다. 그러나 두 가지 미정정 drift 가 존재한다: (1) `spec/data-flow/integration.md §1.2.1` line 90 의 sequence diagram 이 여전히 `install_token=NULL` 을 표기하며, (2) `spec/2-navigation/4-integration.md` Rationale TTL 기준 단락에 "callback 성공 시 ... NULL 로 비워진다" 가 잔존한다. target plan 은 이 두 위치를 이미 정합한 근거로 인용하지만 사실과 다르다. 추가로 `cafe24-data-model-strengthen` 이 구 정책(callback 성공 시 NULL)으로 구현·테스트를 완료했으므로, spec 정정 이후 backend 구현도 함께 갱신되어야 완전한 정합이 달성된다. 이 후속 구현 갱신이 현 plan 에 명시되지 않은 점이 누락 위험이다.
+
+---
+
+### 위험도
+
+MEDIUM

```

---

### 파일 3: review/consistency/2026/05/16/12_24_55/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/12_24_55/rationale_continuity/review.md b/review/consistency/2026/05/16/12_24_55/rationale_continuity/review.md
new file mode 100644
index 00000000..e3f0715f
--- /dev/null
+++ b/review/consistency/2026/05/16/12_24_55/rationale_continuity/review.md
@@ -0,0 +1,30 @@
+### 발견사항
+
+이 검토는 `plan/in-progress/spec-draft-data-model-install-token-followup.md` 가 제안하는 `spec/1-data-model.md §2.10` 두 컬럼 설명 정정이 기존 spec Rationale 과 충돌하는지를 검토한다.
+
+검토 대상 변경:
+1. `Integration.install_token`: "callback 성공 시 NULL" → "callback 성공 시 보존, expired/삭제 시에만 NULL"
+2. `Integration.install_token_issued_at`: "callback 성공 시 NULL" → "callback 성공 시 보존, expired/삭제 시에만 NULL"
+
+---
+
+기각된 대안 재도입, 합의 원칙 위반, 무근거 번복, invariant 충돌 — 네 관점 모두에서 충돌 없음.
+
+**근거 추적:**
+
+- `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상 (2026-05-15)": `pending_install → connected` 전이 시 token 보존 (옛: NULL 처리 → 새: 그대로) 을 명시적으로 결정.
+- 동 Rationale "install_token TTL 24h (2026-05-16 보강)": `callback 성공 시 install_token 과 install_token_issued_at 모두 보존. 옛 NULL 처리 기술은 "install_token persistent 격상" 결정과 미정합 표기 잔존이었다` 를 명시적으로 인정하고 기록.
+- NULL 처리가 유지되는 경로(`pending_install → expired (install_timeout)` 의 24h TTL 만료, 통합 삭제) 도 Rationale 에서 명시 — target 변경이 이 구분을 그대로 반영.
+- V045 partial UNIQUE `(install_token) WHERE install_token IS NOT NULL` invariant: connected 전이 후 token 이 보존됨으로써 해당 행이 UNIQUE 인덱스 범위에 포함되어 더 강하게 보호됨. invariant 우회 없음.
+
+검출된 이슈 없음.
+
+---
+
+### 요약
+
+target 문서 (`spec/1-data-model.md §2.10` 두 컬럼 설명 정정) 는 2026-05-15 에 `spec/2-navigation/4-integration.md` Rationale 에 기록된 "install_token persistent 격상" 결정과 2026-05-16 보강 기술을 데이터 모델 spec 에 동기화하는 drift 정정이다. 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 번복, 암묵적 invariant 우회 — 네 관점 어느 것에서도 충돌이 발견되지 않는다. 변경 의도(연결 성공 후 token 보존)와 Rationale 에 명시된 결정 방향이 완전히 일치하며, NULL 처리가 유지되는 경로(TTL 만료, 삭제) 도 Rationale 과 정합한다.
+
+### 위험도
+
+NONE

```

---

### 파일 4: review/consistency/2026/05/16/13_09_46/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_09_46/SUMMARY.md b/review/consistency/2026/05/16/13_09_46/SUMMARY.md
new file mode 100644
index 00000000..0017f2e0
--- /dev/null
+++ b/review/consistency/2026/05/16/13_09_46/SUMMARY.md
@@ -0,0 +1,39 @@
+# Consistency Check SUMMARY — Cafe24 Node UX Phase 3 (impl-prep)
+
+**일자**: 2026-05-16
+**대상**: Phase 3 프런트 Cafe24Config 재작성 (Resource → Operation → 동적 fields → 조건부 pagination). spec/backend 변경 없음.
+**worktree**: cafe24-node-ux-frontend-f5a3b8
+
+## 5 checker 결과
+
+| checker | status | issues | 위험도 | 보고서 |
+|---|---|---|---|---|
+| cross_spec | success | 4 | LOW | [cross_spec/review.md](cross_spec/review.md) |
+| naming_collision | success | 2 | NONE | [naming_collision/review.md](naming_collision/review.md) |
+| rationale_continuity | success | 2 | LOW | [rationale_continuity/review.md](rationale_continuity/review.md) |
+| plan_coherence | success | 7 | HIGH→해소 | [plan_coherence/review.md](plan_coherence/review.md) |
+| convention_compliance | success | 2 | LOW | [convention_compliance/review.md](convention_compliance/review.md) |
+
+## Critical 해소 내역
+
+plan_coherence 의 CRITICAL 1건:
+
+- **i18n dict 모놀리식 파일 충돌** — PR #82 (2026-05-16 머지) 가 `frontend/src/lib/i18n/dict/{ko,en}.ts` 모놀리식 두 파일을 `dict/{ko,en}/<namespace>.ts` 22개로 split 했다. Phase 3 worktree 는 12 commits behind 상태에서 옛 파일을 수정하고 있었다.
+- **해소**: `git stash -u` → `git rebase origin/main` → 충돌 발생 (DU: 옛 파일들이 main 에서 삭제됨) → `git rm` 으로 옛 파일 폐기 → 신규 i18n 키 12개를 `dict/{ko,en}/nodeConfigs.ts` 의 동일 namespace 위치에 재적용 → 옛 키 (`cafe24OperationPlaceholder`, `cafe24OperationHint`, `cafe24FieldsKeyPlaceholder`, `cafe24FieldsValuePlaceholder`, `cafe24Fields`) 제거 → frontend vitest 1392/1392 통과 + tsc 통과.
+
+## WARNING 잔존
+
+plan_coherence 의 2건:
+
+- **plan frontmatter 의 worktree 필드 미갱신** — Phase 3 worktree (`cafe24-node-ux-frontend-f5a3b8`) 가 frontmatter 에 없었음. **해소**: frontmatter 를 `worktree: cafe24-node-ux-frontend-f5a3b8 (Phase 3, active)` 로 갱신.
+- **Phase 2 체크리스트 미체크** — plan 본문의 Phase 2 항목들이 `[ ]` 인 채로 남아 있었음. **해소**: Phase 2 체크리스트 전체를 `[x]` 로 갱신하며 실제 산출물 (`public-meta.ts`, `planned.ts`, `catalog-sync.spec.ts` 확장, frontend types 등) 매핑.
+
+## INFO/잔존 권고
+
+- **spec/4-nodes/4-integration/4-cafe24.md §9.9 (Fields 편집 버퍼 분리 rationale)** — PR #77 이 추가한 절. 본 Phase 3 가 KeyValueEditor 와 그 내부 버퍼 패턴을 완전히 폐기하므로 §9.9 의 적용 대상이 사라졌다. 단 본 PR 은 frontend 만 다루므로 spec 갱신은 후속 project-planner 트랙에 위임 — Phase 4 후속 항목으로 추가.
+- **`SelectField.options[].disabled?` 확장** — optional 추가라 기존 call site 영향 없음. 향후 다른 노드도 disabled 옵션 패턴을 채택할 수 있음 (cross_spec INFO).
+- **i18n parity 테스트** — PR #82 split 이후 ko ↔ en parity 단위 테스트가 도입되어 있음 (`harness-i18n-userguide-gap` plan). Phase 3 의 12 키 양쪽 추가는 parity 테스트로 검증됨 (vitest 통과).
+
+## BLOCK: NO
+
+CRITICAL 1건 (i18n split rebase) 해소, WARNING 2건 해소. 잔존 INFO 는 본 PR 차단 사유 아님.

```

---

### 파일 5: review/consistency/2026/05/16/13_09_46/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_09_46/convention_compliance/review.md b/review/consistency/2026/05/16/13_09_46/convention_compliance/review.md
new file mode 100644
index 00000000..817081bd
--- /dev/null
+++ b/review/consistency/2026/05/16/13_09_46/convention_compliance/review.md
@@ -0,0 +1,93 @@
+# Convention Compliance Review — Cafe24Config Phase 3 Frontend Rewrite
+
+**Session**: `review/consistency/2026/05/16/13_09_46/convention_compliance/`
+**Target files**:
+- `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`
+- `frontend/src/components/editor/settings-panel/node-configs/shared.tsx`
+- `frontend/src/lib/i18n/dict/ko.ts` & `en.ts`
+- `frontend/src/components/editor/settings-panel/node-configs/__tests__/cafe24-config.test.tsx`
+- `plan/in-progress/cafe24-node-resource-operation-ux.md`
+
+---
+
+## 발견사항
+
+### 발견사항 1
+- **[WARNING]** Plan frontmatter `worktree` 필드가 다중 워크트리 슬래시 표기를 사용
+  - target 위치: `plan/in-progress/cafe24-node-resource-operation-ux.md` L2
+  - 위반 규약: `CLAUDE.md` §"PLAN 문서 라이프사이클" — frontmatter `worktree:` 는 "이 plan 이 살아있는 worktree 디렉토리 이름" 단수 값이어야 한다
+  - 상세: 현재 값은 `cafe24-node-ux-catalog-4b8f2c (Phase 1) / cafe24-node-ux-impl-9d3e1a (Phase 2~)` 로, 슬래시로 이어진 두 개의 옛 워크트리 이름과 주석이 혼재한다. Phase 3 의 실제 작업 워크트리는 `cafe24-node-ux-frontend-f5a3b8` 인데 frontmatter 에 반영되지 않았다. `plan_coherence` checker 가 이 필드를 `glob .claude/worktrees/<value>/` 경로로 대조할 때 매칭 실패할 수 있다.
+  - 제안: Phase 3 착수 시점에 `worktree: cafe24-node-ux-frontend-f5a3b8` 로 덮어썼어야 한다. 복수 Phase 이력을 보존하려면 `worktree:` 는 단수 최신 값으로 유지하고 이전 Phase 기록은 본문에 서술한다.
+
+---
+
+### 발견사항 2
+- **[WARNING]** `readFieldValues` JSDoc 이 `export` 를 선언하나 실제 함수는 unexported
+  - target 위치: `integration-configs.tsx` L320–322
+  - 위반 규약: 명시적 규약 없음 (코드 정확성 문제). 단, `spec/conventions/cafe24-api-metadata.md` §4 와 plan Phase 3 체크리스트는 "단위 테스트에서 직접 행사 가능"임을 전제로 기술되어 있다.
+  - 상세: JSDoc 주석 L320에 `"Exported so the conversion can be exercised directly by unit tests."` 라고 기술되어 있으나, L322 함수 선언은 `export` 키워드 없이 `function readFieldValues(...)` 다. 실제 테스트(`cafe24-config.test.tsx`)는 이 함수를 직접 import 하지 않고 컴포넌트를 통해 간접 검증한다. 주석이 의도를 반영하지 못하거나(주석 오류), 아니면 export 가 빠진 것(구현 오류)이다.
+  - 제안: (a) 실제 export 를 추가하고 테스트에서 직접 unit-test 하거나, (b) JSDoc 에서 "Exported so…" 문구를 삭제하고 "Tested indirectly via Cafe24Config" 로 수정한다.
+
+---
+
+### 발견사항 3
+- **[INFO]** i18n 키 12개 신규 / 4개 삭제 — ko.ts 와 en.ts 완전 패리티 확인됨 (이슈 없음, 기록용)
+  - target 위치: `frontend/src/lib/i18n/dict/ko.ts` L1100–1121, `en.ts` L1105–1126
+  - 위반 규약: 없음
+  - 상세: 12개 신규 키(`cafe24OperationSelectPlaceholder` 외 11개) 가 ko.ts 와 en.ts 양쪽에 각 1회 존재하고, 삭제된 4개 키(`cafe24OperationPlaceholder`, `cafe24OperationHint`, `cafe24FieldsKeyPlaceholder`, `cafe24FieldsValuePlaceholder`) 가 양쪽 모두에서 없음이 확인되었다. 패리티 완전 준수.
+  - 제안: 없음.
+
+---
+
+### 발견사항 4
+- **[INFO]** `ExpressionInput bare` 사용 패턴 — 기존 컴포넌트와 일관됨 (이슈 없음, 기록용)
+  - target 위치: `integration-configs.tsx` L416, L57–63
+  - 위반 규약: 없음
+  - 상세: `Cafe24FieldRow` 및 `RecipientList` 내부의 `ExpressionInput bare` 패턴은 `HttpRequestConfig`(full, L113–119) 및 `SendEmailConfig`(multiline, L673–694) 와 구분되는 "인라인 내장" 용도로 사용되며, 이 구분은 프로젝트 내 기존 override 패턴과 일치한다.
+  - 제안: 없음.
+
+---
+
+### 발견사항 5
+- **[INFO]** 테스트 파일 vitest + RTL 관용구 — 기존 테스트와 일관됨 (이슈 없음, 기록용)
+  - target 위치: `cafe24-config.test.tsx` L7–8
+  - 위반 규약: 없음
+  - 상세: `import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"` + `import { render, screen, fireEvent } from "@testing-library/react"` 는 동일 디렉토리의 `integration-selector.test.tsx` / `trigger-configs.test.tsx` 와 동일한 import 스타일이다. `userEvent` 대신 `fireEvent` 사용도 기존 파일과 일치한다. 14개 케이스가 plan Phase 3 체크리스트 14 케이스와 1:1 대응한다.
+  - 제안: 없음.
+
+---
+
+### 발견사항 6
+- **[INFO]** SelectField.options[].disabled? 추가 — 하위 호환적 확장 (이슈 없음, 기록용)
+  - target 위치: `shared.tsx` L69
+  - 위반 규약: 없음
+  - 상세: 기존 `options: { value: string; label: string }[]` 에 선택적 필드 `disabled?: boolean` 을 추가했다. 기존 호출부(`HttpRequestConfig`, `DatabaseQueryConfig`, `SendEmailConfig`)는 `disabled` 를 전달하지 않으므로 하위 호환이 유지된다. JSDoc 이 Cafe24 용도를 명확히 기술한다.
+  - 제안: 없음.
+
+---
+
+### 발견사항 7
+- **[INFO]** 금지 항목 — 위반 없음 (기록용)
+  - target 위치: 전체 변경 파일
+  - 위반 규약: `CLAUDE.md` §"외부 LLM 호출 정책"
+  - 상세: `claude -p`, `subprocess.run(["claude"...])`, `anthropic.Anthropic().messages.create(...)` 호출 없음. `prd/`, `memory/`, `user_memo/` 경로 참조 없음. 소스 파일에 emoji 없음.
+  - 제안: 없음.
+
+---
+
+### 발견사항 8
+- **[INFO]** React 관용구 — useEffect 없음, 모든 파생 상태는 render-time 직접 계산 (이슈 없음, 기록용)
+  - target 위치: `integration-configs.tsx` L421–638 (`Cafe24Config`)
+  - 위반 규약: 없음
+  - 상세: `Cafe24Config` 는 `useEffect` 를 전혀 사용하지 않는다. `extras`, `resource`, `operation`, `supportedOp`, `plannedOp`, `fieldValues`, `resourceOptions`, `operationOptions`, `coverageHint`, `requiredFields`, `optionalFields` 모두 render 함수 내 동기 계산이다. `useT` 가 최상위에서 한 번 호출되고 조건부 분기 내에서 재호출되지 않아 hooks 규칙 준수. `Cafe24FieldRow` 는 `t` 를 prop 으로 주입받아 자체 hook 호출 없음 (별도 컴포넌트로 선언됐으나 hooks 규칙 상 허용).
+  - 제안: 없음.
+
+---
+
+## 요약
+
+Phase 3 변경 세트는 프로젝트 정식 규약을 전반적으로 잘 준수하고 있다. i18n 키 패리티 완전, 금지 항목 없음, 테스트 관용구 일관, React hooks 규칙 준수, SelectField 확장 하위 호환. 두 건의 WARNING 이 발견되었다: 하나는 plan frontmatter 의 `worktree` 필드가 Phase 3 실제 워크트리(`cafe24-node-ux-frontend-f5a3b8`)를 반영하지 않아 `plan_coherence` checker 의 경로 매칭이 실패할 수 있는 점이고, 다른 하나는 `readFieldValues` JSDoc 에 "Exported so…" 라고 기술되어 있으나 실제 `export` 키워드가 없는 문서-구현 불일치다. 두 건 모두 런타임 동작에는 영향이 없으나 유지보수 혼란을 초래할 수 있어 수정을 권장한다.
+
+## 위험도
+
+LOW

```

---

### 파일 6: review/consistency/2026/05/16/13_09_46/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_09_46/cross_spec/review.md b/review/consistency/2026/05/16/13_09_46/cross_spec/review.md
new file mode 100644
index 00000000..3f8d1451
--- /dev/null
+++ b/review/consistency/2026/05/16/13_09_46/cross_spec/review.md
@@ -0,0 +1,44 @@
+# Cross-Spec 일관성 검토 — Phase 3 Cafe24Config 재작성
+
+검토 대상: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` (Cafe24Config), `shared.tsx`, i18n dict, `cafe24-config.test.tsx`
+기준 spec: `spec/4-nodes/4-integration/4-cafe24.md`, `spec/conventions/cafe24-api-catalog/_overview.md`, `spec/2-navigation/4-integration.md`, `spec/5-system/11-mcp-client.md`
+
+---
+
+## 발견사항
+
+- **[WARNING]** §9.9 편집 버퍼(내부 Array 버퍼) — spec 본문이 폐기되지 않았으나 구현은 이를 사용하지 않음
+  - target 위치: `integration-configs.tsx` — `Cafe24Config` 전체, `readFieldValues()` 함수 (line 322)
+  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` §2 "편집 버퍼" 한 줄, §9.9 전체 (Fields 편집 UI 의 내부 버퍼 분리 Rationale)
+  - 상세: spec §2 는 "UI 는 내부적으로 `Array<{key, value}>` 편집 버퍼를 React state 로 관리하고, `onChange` 시 빈 key 행을 제거한 뒤 `Record<string, unknown>` 로 변환해 `config.fields` 에 저장한다"고 기술한다. §9.9 Rationale 은 이 결정의 배경으로 "빈 key 행을 즉시 버퍼에서 떨어뜨리지 않도록 해 추가 버튼이 행을 즉시 보여준다"는 PR #62 해결 시나리오를 보존하고 있다. 그러나 Phase 3 구현은 `Array<{key, value}>` 버퍼가 전혀 없다. 대신 typed-dynamic-form 방식으로 각 필드가 메타데이터 정의에 의해 결정되며, `readFieldValues()`는 `Record<string, string>` 를 직접 state 없이 파생한다. KeyValueEditor 의존 제거로 "빈 key 행" 시나리오 자체가 消失했기 때문에 버퍼가 더 이상 필요 없다. 그러나 spec 본문과 Rationale 은 아직 구버전 패턴을 "채택된 결정"으로 서술하고 있어, spec을 읽는 다른 개발자가 이 버퍼를 재도입하거나 회귀 버그로 판단할 수 있다.
+  - 제안: spec §2 의 "편집 버퍼" 한 줄을 삭제하고 §9.9 Rationale 을 "Phase 3(typed dynamic form) 이후 불필요해짐" 상태로 갱신하는 spec 수정 PR을 후속으로 제출. 구현 PR 은 그대로 진행 가능하나 spec 갱신이 미완 상태임을 plan 에 후속 항목으로 추가 권장.
+
+- **[INFO]** §1 `pagination.cursor` — spec 에 정의됐으나 UI 가 제공하지 않음
+  - target 위치: `integration-configs.tsx` line 442-443, line 606-630 (Pagination 블록)
+  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` §1 config 필드 표 — `pagination: { limit?: number, offset?: number, cursor?: string }`
+  - 상세: spec §1 은 pagination 객체가 `cursor?: string` 을 포함한다고 명시한다. Phase 3 UI 는 `limit` / `offset` 두 칸만 렌더링하며, `cursor` 입력 위젯이 없다. 현재 구현은 기존 `config.pagination.cursor` 값을 spread(`{ ...pagination, limit: v }`)로 보존은 하지만, 사용자가 cursor 를 입력하거나 확인할 수 없다. spec §2 ASCII mock 또한 Limit/Offset 두 칸만 그렸으므로 mock 은 구현과 일치한다. 그러나 §1 의 cursor 필드 정의와 §2 mock 사이에 이미 존재하는 비일관성이 Phase 3 구현에서 그대로 이월된다.
+  - 제안: cursor-based pagination을 지원하는 operation 이 생기는 시점에 UI 확장을 고려. 현재 PR 에서 별도 조치 불필요. spec §2 mock 에 cursor 가 없으므로 현 구현은 mock 기준으로 정합.
+
+- **[INFO]** planned-op 선택 시 fields 미렌더 — spec 에 명시된 동작과 일치하나 spec 에는 이 분기가 기술되지 않음
+  - target 위치: `integration-configs.tsx` line 548-557 (`{plannedOp && ...}`, `{!supportedOp && !plannedOp && operation && ...}`)
+  - 충돌 대상: `spec/4-nodes/4-integration/4-cafe24.md` §2, `spec/conventions/cafe24-api-catalog/_overview.md` §3 (`planned` status 정의)
+  - 상세: catalog spec §3 은 planned 상태를 "UI 의 Operation 드롭다운에 disabled + 지원 예정 배지로 노출"이라고만 정의한다. Phase 3 구현은 disabled 옵션으로 표현하므로 사용자가 선택 자체를 할 수 없어 planned-op 를 선택했을 때의 UX 분기(`cafe24OperationPlannedHint` 표시)가 실제로 도달할 수 없는 코드 경로다 — planned 옵션이 `disabled: true` 이므로 `handleOperationChange` 가 호출되지 않는다. plan 문서(§3 상세 설계)는 "Planned op 선택 시: dynamic fields 미렌더 + 이 작업은 아직 지원되지 않습니다 한 줄 hint"를 기술했으나 HTML select의 disabled 옵션은 선택 이벤트를 발생시키지 않으므로 이 분기는 dead code다. spec 에는 이 dead-code 상황이 명시되지 않았다.
+  - 제안: 방어적 코드로서 유지하는 것은 무해(legacy 워크플로 호환 또는 programmatic 주입 경우). 단 plan 문서의 "Planned op 선택 시" 시나리오 기술이 실제 UX와 다름을 주석 또는 plan 정정으로 명확화 권장. 스펙에는 영향 없음.
+
+- **[INFO]** `spec/2-navigation/4-integration.md` — Cafe24Config UI 와의 직접 충돌 없음
+  - 검토 결과: `spec/2-navigation/4-integration.md` 는 통합 관리 화면(목록, 상세, OAuth 흐름)을 다루며 Cafe24Config 컴포넌트(노드 에디터 설정 패널)와 영역이 분리된다. Cafe24 관련 키(pending_install, reauthorize 비활성 조건, status 전이 등)는 Phase 3 변경과 교차점이 없다.
+
+- **[INFO]** `spec/5-system/11-mcp-client.md` — Cafe24Config UI 와의 직접 충돌 없음
+  - 검토 결과: `11-mcp-client.md §2.3 Internal Bridge` 가 Cafe24 메타데이터 테이블을 참조하지만 이는 backend `Cafe24McpBridge` 의 도구다. Phase 3 의 frontend `readCafe24Extras()` 는 `GET /nodes/definitions` 페이로드(Phase 2 에서 확립)를 읽으므로 MCP spec 과 교차점 없다.
+
+---
+
+## 요약
+
+Phase 3 구현은 `spec/4-nodes/4-integration/4-cafe24.md` §2 의 ASCII mock(Integration / Resource / Operation / Required / Optional / Pagination 순서 및 구조)을 정확히 따른다. config 불변 필드(integrationId, resource, operation, fields, pagination)는 `handleFieldChange` / `handleOperationChange` / `handleResourceChange` 의 spread 패턴으로 보존된다. planned-operation 의 disabled select 옵션은 catalog spec §3 의 의도와 일치한다. 직접적인 모순(CRITICAL)은 발견되지 않았다. 유일한 실질적 불일치는 §9.9 편집 버퍼 Rationale 이 구현과 달라진 것으로(WARNING), spec 갱신이 후속 PR 로 필요하다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 7: review/consistency/2026/05/16/13_09_46/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_09_46/naming_collision/review.md b/review/consistency/2026/05/16/13_09_46/naming_collision/review.md
new file mode 100644
index 00000000..2c9edc74
--- /dev/null
+++ b/review/consistency/2026/05/16/13_09_46/naming_collision/review.md
@@ -0,0 +1,65 @@
+# Naming Collision Review — Cafe24 Node UX Phase 3
+
+Checker: naming_collision
+Session: 2026/05/16/13_09_46
+Scope: frontend only — integration-configs.tsx, shared.tsx, i18n dicts (en/ko)
+
+---
+
+### 발견사항
+
+- **[INFO]** `Cafe24FieldRow` — `FieldRow` suffix 가 docs 컴포넌트에도 존재
+  - target 신규 식별자: `Cafe24FieldRow` (module-local React component, `integration-configs.tsx`)
+  - 기존 사용처: `frontend/src/components/docs/mdx/field-table.tsx` line 5 — `export interface FieldRow`; `FieldTable` 컴포넌트에서만 사용됨
+  - 상세: 두 심볼은 완전히 다른 모듈에 위치하며 서로 import 관계가 없다. `Cafe24FieldRow` 는 node-configs 내부 비공개 함수형 컴포넌트이고, `FieldRow` 는 docs MDX 테이블용 인터페이스다. 이름이 겹치는 부분은 접미사 `FieldRow` 뿐이고 prefix `Cafe24` 가 명확히 구분한다. 현재 빌드·타입 충돌 없음.
+  - 제안: 충돌이 아니므로 변경 불필요. 다만 `FieldRow` 가 향후 공유 타입 라이브러리로 추출될 경우 `Cafe24FieldRow` 이름이 혼동을 줄 수 있으므로, 그 시점에 `Cafe24FieldItem` 등으로 분리를 검토하면 충분.
+
+- **[INFO]** `SelectField.options[].disabled` — 신규 optional 필드, 기존 call site 영향 없음
+  - target 신규 식별자: `disabled?: boolean` 필드 (`shared.tsx` `SelectField` options 타입, Phase 3 신규 추가)
+  - 기존 사용처: `flow-configs.tsx`, `logic-configs.tsx`, `data-configs.tsx`, `button-list-editor.tsx`, `widgets.tsx` (`SelectWidget`) — 모두 `{ value, label }` 만 전달하며 `disabled` 키를 사용하지 않음
+  - 상세: optional 필드로 추가되었으므로 기존 call site 는 타입 호환이 유지된다. `widgets.tsx` 의 `SelectWidget` 은 `rawOptions` 를 spread(`...o`) 하지만, `UiHint.options` 타입(`{ value: string; label: string }[]`)에 `disabled` 가 없으므로 백엔드 페이로드를 통해 의도치 않은 `disabled` 가 흘러들어올 경로가 현재는 닫혀 있다.
+  - 제안: 이슈 없음. 단, 향후 `UiHint.options` 에 `disabled` 를 추가하거나 백엔드가 해당 키를 내려보낼 경우 `SelectWidget` 의 spread 로 인해 자동으로 동작하게 된다는 점을 인지하면 충분.
+
+---
+
+### 제거된 식별자 잔류 확인
+
+| 제거 대상 | 잔류 여부 |
+|---|---|
+| `normalizeCafe24Fields` (export) | 잔류 없음 — frontend/src 전역 검색 결과 0건 |
+| `fieldRowsToObject` (export) | 잔류 없음 — frontend/src 전역 검색 결과 0건 |
+| i18n `cafe24OperationPlaceholder` | 잔류 없음 — en.ts/ko.ts 및 사용처 모두 0건 |
+| i18n `cafe24OperationHint` | 잔류 없음 — 전역 0건 |
+| i18n `cafe24FieldsKeyPlaceholder` | 잔류 없음 — 전역 0건 |
+| i18n `cafe24FieldsValuePlaceholder` | 잔류 없음 — 전역 0건 |
+
+제거된 export 및 i18n 키에 대한 dangling reference 가 전혀 발견되지 않았다.
+
+---
+
+### 신규 식별자 유일성 확인
+
+| 신규 식별자 | integration-configs.tsx 외 출현 | 판정 |
+|---|---|---|
+| `readCafe24Extras` | 0건 | 충돌 없음 (module-local) |
+| `readFieldValues` | 0건 | 충돌 없음 (module-local) |
+| `pruneFieldsToOperation` | 0건 | 충돌 없음 (module-local) |
+| `findSupportedOperation` | 0건 | 충돌 없음 (module-local) |
+| `findPlannedOperation` | 0건 | 충돌 없음 (module-local) |
+| `Cafe24FieldRow` | 0건 (docs `FieldRow` 와 별개) | 충돌 없음 (INFO 참고) |
+
+---
+
+### 신규 i18n 키 유일성 확인
+
+모든 신규 키(`cafe24OperationSelectPlaceholder`, `cafe24OperationSelectResourceFirst`, `cafe24OperationPlannedSuffix`, `cafe24OperationCoverageHint`, `cafe24OperationPlannedHint`, `cafe24OperationUnknown`, `cafe24FieldsRequired`, `cafe24FieldsOptional`, `cafe24FieldsEmpty`, `cafe24FieldsEnumHint`, `cafe24FieldsBooleanHint`, `cafe24FieldsDefaultHint`)는 `nodeConfigs.integration` 네임스페이스 하에 en.ts/ko.ts 양쪽에 정의되어 있으며, 동일 키가 다른 네임스페이스에 중복 정의된 사례는 없다.
+
+---
+
+### 요약
+
+Phase 3 에서 도입된 신규 식별자(`readCafe24Extras`, `readFieldValues`, `pruneFieldsToOperation`, `findSupportedOperation`, `findPlannedOperation`, `Cafe24FieldRow`) 는 모두 module-local 로 제한되어 있으며 frontend 전역에서 동일 이름의 다른 의미 사용처가 발견되지 않았다. 제거된 export(`normalizeCafe24Fields`, `fieldRowsToObject`) 및 i18n 키 4종의 dangling reference 도 전무하다. `SelectField.options[].disabled` 확장은 optional 추가이므로 기존 call site 에 breaking change 를 유발하지 않는다. `Cafe24FieldRow` 와 docs 의 `FieldRow` 는 접두사로 충분히 구별되며 import 관계가 없어 실질적 충돌이 없다. 전체적으로 명명 충돌 위험도는 없음(NONE) 수준이며, INFO 2건은 미래 확장 시 참고 수준의 관찰사항이다.
+
+### 위험도
+
+NONE

```

---

### 파일 8: review/consistency/2026/05/16/13_09_46/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_09_46/plan_coherence/review.md b/review/consistency/2026/05/16/13_09_46/plan_coherence/review.md
new file mode 100644
index 00000000..0d1b8859
--- /dev/null
+++ b/review/consistency/2026/05/16/13_09_46/plan_coherence/review.md
@@ -0,0 +1,68 @@
+# Plan Coherence Review — Phase 3 Cafe24 Node UX Frontend
+
+**Checker**: plan-coherence-checker
+**Session**: review/consistency/2026/05/16/13_09_46/
+**Worktree under review**: cafe24-node-ux-frontend-f5a3b8
+**Target plan**: plan/in-progress/cafe24-node-resource-operation-ux.md (Phase 3)
+
+---
+
+### 발견사항
+
+- **[CRITICAL]** i18n dict 파일을 이미 split 된 구조와 충돌하는 방식으로 수정 중
+  - target 위치: Phase 3 worktree 의 uncommitted changes — `frontend/src/lib/i18n/dict/en.ts`, `frontend/src/lib/i18n/dict/ko.ts`
+  - 관련 plan: PR #82 (`claude/i18n-dict-split-70d366`) 가 2026-05-16 main 에 머지되어 dict 를 `en/` / `ko/` 하위 22개 파일로 split 했다. Phase 3 worktree 는 현재 main 보다 12 commits 뒤에 있으며(`branch is behind 'origin/main' by 12 commits`), split 이전의 모놀리식 `en.ts`·`ko.ts` 를 직접 수정하고 있다.
+  - 상세: Phase 3 가 추가하는 Cafe24 관련 i18n 키(`cafe24OperationSelectPlaceholder`, `cafe24FieldsRequired`, `cafe24FieldsOptional` 등)는 현재 main 기준으로는 `frontend/src/lib/i18n/dict/en/nodeConfigs.ts` 와 `frontend/src/lib/i18n/dict/ko/nodeConfigs.ts` 에 들어가야 한다. Phase 3 가 그대로 PR 을 올리면 이미 split 된 파일을 되돌리거나 두 모놀리식 파일이 동시에 존재하는 상태가 되어 빌드·테스트가 깨진다. harness-i18n-userguide-gap plan (PR #61) 이 도입한 `ko ↔ en parity 단위 테스트`도 split 구조를 전제하므로 동일하게 충돌한다.
+  - 제안: Phase 3 worktree 를 main 으로 rebase(`git rebase origin/main`) 한 뒤 i18n 변경을 split 구조(`en/nodeConfigs.ts`, `ko/nodeConfigs.ts`)에 맞게 재작성해야 한다. 이 작업 없이는 PR 머지 불가.
+
+- **[WARNING]** plan frontmatter 의 `worktree` 필드가 현재 작업 worktree 와 불일치
+  - target 위치: `plan/in-progress/cafe24-node-resource-operation-ux.md` frontmatter 1행 — `worktree: cafe24-node-ux-catalog-4b8f2c (Phase 1) / cafe24-node-ux-impl-9d3e1a (Phase 2~)`
+  - 관련 plan: Phase 3 는 `cafe24-node-ux-frontend-f5a3b8` worktree 에서 진행 중이지만 plan 에 이 worktree 이름이 등록되어 있지 않다. Phase 2 worktree (`cafe24-node-ux-impl-9d3e1a`) 는 PR #80 머지 후에도 제거되지 않고 남아 있으며, plan frontmatter 가 갱신되지 않아 plan_coherence 자동 검출(worktree 필드 기반)이 Phase 3 의 실제 작업 위치를 추적할 수 없다.
+  - 제안: plan frontmatter 를 `worktree: cafe24-node-ux-frontend-f5a3b8 (Phase 3)` 로 갱신하고, `.claude/worktrees/cafe24-node-ux-impl-9d3e1a` worktree 를 `git worktree remove` 로 정리한다.
+
+- **[WARNING]** Phase 2 체크박스가 plan 에서 미체크 상태이나 실제로는 완료됨
+  - target 위치: `plan/in-progress/cafe24-node-resource-operation-ux.md` §Phase 2 체크리스트 — 10개 항목 전부 `[ ]`
+  - 관련 plan: PR #80 (`claude/cafe24-node-ux-impl-9d3e1a`) 이 2026-05-16 main 에 머지되어 Phase 2 의 모든 백엔드 파일(`public-meta.ts`, `planned.ts`, `NodeComponent.extras`, `NodeDefinitionDto.extras` 등)이 main 에 존재함이 확인됐다. plan 문서는 갱신되지 않아 Phase 2 항목이 미완료로 보인다.
+  - 제안: Phase 2 체크리스트 전체를 `[x]` 로 갱신하고 Phase 3 항목의 선행 조건 충족 여부를 명시한다. Phase 3 PR 올리기 전에 plan 을 동기화해야 혼선을 막는다.
+
+- **[WARNING]** §9.9 Fields 편집 버퍼 Rationale 이 Phase 3 rewrite 로 부분 무효화될 수 있음
+  - target 위치: `spec/4-nodes/4-integration/4-cafe24.md` §9.9 (Fields 편집 UI 의 내부 버퍼 분리)
+  - 관련 plan: Phase 3 는 `Cafe24Config` 의 fields 영역을 KeyValueEditor 에서 metadata 기반 동적 폼(`required/optional 두 그룹, type 별 위젯`)으로 완전히 교체한다. §9.9 는 `Array<{key, value}>` 편집 버퍼 패턴을 "채택(B)" 로 기록하고 있으나, 이 패턴은 옛 KeyValueEditor 에 적용됐던 것이다. 새 동적 폼에서는 fields 가 `config.fields: Record<string, unknown>` 에 개별 위젯으로 직접 쓰이므로 `Array<{key, value}>` 버퍼가 더 이상 필요 없거나 다른 형태로 바뀐다. spec §2 가 이미 새 UX 를 기술하고 있으나, §9.9 는 옛 구조에 기반한 채로 남을 가능성이 있다.
+  - 제안: Phase 3 구현이 완료된 뒤, spec §9.9 의 "채택(B)" 설명이 새 구현과 정합한지 확인하고, 더 이상 유효하지 않다면 project-planner 를 통해 §9.9 를 갱신하거나 Phase 3 의 새 fields 패턴을 명시하는 §9.10 을 추가한다. 본 PR 의 결정 사항이 아니므로 spec 수정은 후속 plan 에 기록한다.
+
+- **[WARNING]** `cafe24-pending-polish.md` 의 `변경 1` FE 항목과 `shared.tsx` 수정의 잠재 중복 검토 필요
+  - target 위치: Phase 3 변경 목록 — `shared.tsx` (SelectField disabled option 추가)
+  - 관련 plan: `plan/in-progress/cafe24-pending-polish.md` 변경 1 에 `FE: reauthorize 버튼 비활성`, `FE: lastError.message status-badge detail 표시`, FE 폴링 훅 등 다수 frontend 항목이 미완료로 남아 있다. 해당 plan 의 worktree 는 `cafe24-pending-polish-7fdb7e` 이고 현재 활성 여부가 불분명하다. Phase 3 가 `shared.tsx` 에 SelectField disabled option 패턴을 추가하는데, 향후 변경 1 구현 시 동일 파일을 수정하게 되면 merge conflict 위험이 있다.
+  - 제안: `cafe24-pending-polish.md` 의 변경 1 을 담당할 worktree 가 착수 전에 Phase 3 를 먼저 merge 한 main 기준으로 작업을 시작하도록 순서를 명시적으로 기록한다. `cafe24-pending-polish.md` 에 "Phase 3 PR 머지 후 착수" 메모를 추가한다.
+
+- **[INFO]** Phase 2 worktree 미정리 — `cafe24-node-ux-impl-9d3e1a`
+  - target 위치: `.claude/worktrees/cafe24-node-ux-impl-9d3e1a` (파일시스템에 존재)
+  - 관련 plan: PR #80 머지 완료. CLAUDE.md 정책: "작업이 PR 로 merge 되면 즉시 `git worktree remove` 로 정리".
+  - 제안: `git worktree remove .claude/worktrees/cafe24-node-ux-impl-9d3e1a` 로 정리.
+
+- **[INFO]** `cafe24-pending-polish.md` — worktree 미등록 상태
+  - target 위치: `plan/in-progress/cafe24-pending-polish.md` frontmatter `worktree: cafe24-pending-polish-7fdb7e`
+  - 관련 plan: 해당 worktree 가 `.claude/worktrees/` 에 존재하지 않는다. plan 이 in-progress 상태이나 담당 worktree 가 없어 현재 어떤 상태인지 추적 불가. 변경 1 이하 다수 항목이 미완료.
+  - 제안: 다음 착수자가 worktree 를 새로 만들고 frontmatter 를 갱신한다. 또는 plan 을 분기해 Phase 3 이후 신규 worktree 에서 이어받도록 한다.
+
+---
+
+### 요약
+
+Phase 3 (`cafe24-node-ux-frontend-f5a3b8`) 의 핵심 구현 방향(integration-configs.tsx 재작성, shared.tsx SelectField disabled option, Cafe24Config 테스트)은 `spec/4-nodes/4-integration/4-cafe24.md` §2 의 목표 UX 와 정합하며, 다른 진행 중 plan 과 `integration-configs.tsx` 또는 `shared.tsx` 를 동시 수정하는 worktree 충돌은 발견되지 않았다. 그러나 가장 심각한 문제는 **i18n dict 구조 충돌**이다: PR #82 가 이미 main 에서 dict 를 22개 파일로 split 했는데 Phase 3 worktree 는 12 commits 뒤에 있어 모놀리식 `en.ts`·`ko.ts` 를 수정 중이다. rebase 없이 PR 을 올리면 빌드·parity 테스트가 즉시 깨진다. 추가로 plan frontmatter 의 worktree 필드 미갱신, Phase 2 체크박스 미갱신, §9.9 Rationale 의 잠재적 무효화, Phase 2 worktree 미정리 등 WARNING/INFO 수준의 추적 문제가 4건 발견됐다.
+
+### 위험도
+
+HIGH
+
+---
+
+*참조 파일*
+- `plan/in-progress/cafe24-node-resource-operation-ux.md`
+- `plan/in-progress/cafe24-pending-polish.md`
+- `plan/in-progress/cafe24-pending-polish-followup.md`
+- `plan/in-progress/cafe24-data-model-strengthen.md`
+- `plan/in-progress/harness-i18n-userguide-gap.md`
+- `spec/4-nodes/4-integration/4-cafe24.md` §2, §9.9
+- `.claude/worktrees/cafe24-node-ux-frontend-f5a3b8/` (uncommitted: en.ts, ko.ts, integration-configs.tsx, shared.tsx)
+- `.claude/worktrees/cafe24-node-ux-impl-9d3e1a/` (PR #80 머지 후 미정리)

```

---

### 파일 9: review/consistency/2026/05/16/13_09_46/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_09_46/rationale_continuity/review.md b/review/consistency/2026/05/16/13_09_46/rationale_continuity/review.md
new file mode 100644
index 00000000..8e93ce4b
--- /dev/null
+++ b/review/consistency/2026/05/16/13_09_46/rationale_continuity/review.md
@@ -0,0 +1,34 @@
+# Rationale 연속성 검토 — Cafe24 노드 UX Phase 3
+
+검토 대상: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` `Cafe24Config` 재작성 (Phase 3)
+기준 spec: `spec/4-nodes/4-integration/4-cafe24.md` §2, §9.1, §9.9 및 Rationale 전체
+
+---
+
+## 발견사항
+
+### 1. [INFO] §9.9 내부 버퍼 분리 결정 — 적용 범위 변화, Rationale 갱신 권장
+
+- **target 위치**: `integration-configs.tsx` 내 `Cafe24Config` 전체 — 특히 `readFieldValues()` / `handleFieldChange()` / `pruneFieldsToOperation()`
+- **과거 결정 출처**: `spec/4-nodes/4-integration/4-cafe24.md` §9.9 "Fields 편집 UI 의 내부 버퍼 분리" (옵션 B 채택)
+- **상세**: §9.9 는 `Array<{key, value}>` 내부 버퍼를 채택한 핵심 이유로 "빈 key 행이 object 변환 시 즉시 제거되어 '추가' 버튼이 행을 보여주지 못한다"를 든다 — 이 문제는 KeyValueEditor 에서 사용자가 수동으로 행을 추가하는 UX를 전제한다. Phase 3 의 typed 동적 폼은 Fields 행을 메타데이터로 고정 렌더링하므로 "빈 key 행 추가" 시나리오가 구조적으로 존재하지 않는다. 그 결과 §9.9 가 채택한 `Array<{key, value}>` 버퍼 대신 `Record<string, string>` (`readFieldValues` 반환값) 를 편집 상태로 직접 사용한다. 이는 §9.9 의 문자 그대로의 패턴(배열 버퍼)을 따르지 않지만, §9.9 **적용 범위** 단서("object-shaped backend contract 를 가진 통합 노드에 한정")는 여전히 적합하다 — 바뀐 것은 버퍼 *형태*이지 `Record<string, unknown>` 외부 직렬화 계약이 아니다. 기술적 충돌은 아니나, §9.9 가 묘사하는 "배열 버퍼 → onChange 시 변환" 패턴과 새 구현의 "Record 직접 사용" 패턴 간에 독자가 혼란을 느낄 수 있다.
+- **제안**: Phase 3 PR merge 후 `project-planner` 에 §9.9 보강을 위임한다. 구체적으로 "typed 동적 폼(필드가 메타데이터로 고정)에서는 빈 key 행 시나리오가 없으므로 `Record<string, string>` 직접 편집이 허용된다. 배열 버퍼 패턴은 KeyValueEditor 기반 자유 추가/삭제 UX에만 필요하다"는 설명을 적용 범위 단서에 추가한다. spec 수정 전까지 §9.9 의 핵심 invariant — **외부 직렬화 형식은 `Record<string, unknown>` 불변** — 는 Phase 3 구현이 완전히 준수한다.
+
+---
+
+### 2. [INFO] Operation 자유 텍스트 → select 전환 — 옛 임시 결정의 공식 해소, Rationale 갱신 필요 없음 (단, 확인 메모 권장)
+
+- **target 위치**: `integration-configs.tsx` L535–547 (`SelectField` for Operation) vs 과거 구현 (`ExpressionInput` for Operation)
+- **과거 결정 출처**: `git show 52103cd9` (Phase 8-10 커밋 메시지) — "A richer Operation select that loads metadata from the backend stays a follow-up — the metadata table lives in backend code today"
+- **상세**: Phase 8-10 커밋은 Operation 을 `ExpressionInput` (자유 텍스트) 로 구현하면서, 이를 임시 조치이며 metadata 기반 select 는 follow-up 이라고 명시했다. 이 임시 결정은 `spec/4-nodes/4-integration/4-cafe24.md §9 Rationale` 어디에도 정식 항목으로 기록되지 않았다 — 즉 **spec Rationale 이 자유 텍스트를 "채택된 대안"으로 승인한 적이 없다**. §2 UI mock 은 최초 spec 작성일(2026-05-13)부터 "Operation: [Search products dropdown]" 으로 select 를 명세했다. Phase 3 는 spec 이 처음부터 의도한 형태를 구현한 것으로, Rationale 번복이 아닌 Rationale 이행이다. 단, "자유 텍스트가 임시 운용됐다"는 사실이 문서 어디에도 남지 않으므로, 향후 독자가 "왜 이전에 ExpressionInput 이었나?"를 알 수 없다.
+- **제안**: §9.3 또는 CHANGELOG 에 한 줄 — "Phase 3(2026-05-16) 에서 Operation ExpressionInput(임시, 커밋 52103cd9) 을 catalog extras 기반 select 로 전환. 이로써 §2 spec 의 원래 의도가 완전히 구현됨" — 을 추가할 것을 권장한다 (project-planner 위임, 이 PR 에서 불필요).
+
+---
+
+## 요약
+
+Phase 3 구현은 spec/4-nodes/4-integration/4-cafe24.md Rationale 의 어떤 항목도 직접 위반하거나 명시적으로 기각된 대안을 재도입하지 않는다. 가장 유의할 점은 §9.9 다 — 배열 버퍼 패턴의 적용 범위가 "typed 동적 폼" 시나리오에서 자연스럽게 달라졌으나, §9.9 의 핵심 invariant(외부 직렬화 = `Record<string, unknown>`)는 완전히 준수된다. 표현식(`{{ }}`) 지원 결정(2026-05-16 확정)도 모든 필드 행에 `ExpressionInput` 을 사용함으로써 충실히 이행된다. §2 UI mock 과의 정합성도 완전하다 — Resource/Operation select, Required/Optional 그룹, 조건부 Pagination 이 모두 spec 그대로 구현되어 있다. 발견사항 2건은 모두 INFO 수준의 문서 보완 권장이며, 구현 차단 사유가 없다.
+
+## 위험도
+
+LOW

```

---

### 파일 10: review/consistency/2026/05/16/13_29_47/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_29_47/SUMMARY.md b/review/consistency/2026/05/16/13_29_47/SUMMARY.md
new file mode 100644
index 00000000..14f2f60c
--- /dev/null
+++ b/review/consistency/2026/05/16/13_29_47/SUMMARY.md
@@ -0,0 +1,41 @@
+# Consistency Check SUMMARY — Cafe24 Phase 4 (spec §9.9 cleanup)
+
+**일자**: 2026-05-16
+**대상**: Phase 3 (PR #88) 머지 후속 — `spec/4-nodes/4-integration/4-cafe24.md` §2 / §9.9 / CHANGELOG 정리 + plan 갱신.
+**worktree**: cafe24-spec-buffer-cleanup-2b6e9c
+
+## 5 checker 결과
+
+| checker | status | issues | 위험도 | 보고서 |
+|---|---|---|---|---|
+| cross_spec | success | 6 | LOW | [cross_spec/review.md](cross_spec/review.md) |
+| naming_collision | success | 7 | LOW | [naming_collision/review.md](naming_collision/review.md) |
+| rationale_continuity | success | 5 | LOW | [rationale_continuity/review.md](rationale_continuity/review.md) |
+| plan_coherence | success | 6 | CRITICAL→해소 (false positive) | [plan_coherence/review.md](plan_coherence/review.md) |
+| convention_compliance | success | 4 | LOW | [convention_compliance/review.md](convention_compliance/review.md) |
+
+## Critical 해소 내역 (false positive)
+
+plan_coherence 의 CRITICAL 1건:
+
+- **`cafe24-spec-cleanup-f4d8e2` worktree 가 동일 파일을 동시 수정** — 보고됨.
+- **검증**: `git log origin/main..claude/cafe24-spec-cleanup-f4d8e2 --oneline` → **commits ahead 0건**. 해당 branch 의 모든 commit 은 PR #76 머지(`b78a2f6e`) 로 이미 origin/main 에 반영됨. 워크트리 디렉토리는 PR 머지 후 정리되지 않은 leftover.
+- **해소**: 해당 stale worktree (`.claude/worktrees/cafe24-spec-cleanup-f4d8e2`) + 브랜치 (`claude/cafe24-spec-cleanup-f4d8e2`) 를 `git worktree remove --force` + `git branch -D` 로 제거.
+- **잔존 stale worktree (7개)**: cafe24-node-ux-catalog-4b8f2c, cafe24-node-ux-impl-9d3e1a, cafe24-node-ux-frontend-f5a3b8, cafe24-spec-sync-e2a8b9, cafe24-backlog-e8a3b1, cafe24-spec-followup-c5b7a9, cafe24-w2-spec-d9f2a3 — 모두 origin/main 에 머지된 후 미정리 상태. **본 PR 변경 파일과 충돌 없음** (다른 파일·이미 머지된 변경). 별 정리 task 로 분리 권장 (사용자 명시적 허가 필요).
+
+## INFO/WARN 잔존
+
+- **plan frontmatter 의 worktree 필드 불일치** (plan_coherence): 현재 `cafe24-node-ux-frontend-f5a3b8 (Phase 3, active)` 로 적혀 있지만 실제 작업은 `cafe24-spec-buffer-cleanup-2b6e9c` (Phase 4) 에서 진행 중. 본 PR 의 plan 갱신은 Phase 4 섹션 추가에 집중했고 frontmatter 는 의도적으로 두었다 (plan 본문에 Phase 4 worktree 명시).
+- **stale worktree 일괄 정리** — 별 task. 사용자 결정 후 진행.
+- 그 외 INFO 28건은 표면 향상 권고로 본 PR 차단 사유 아님.
+
+## 변경 효과 (서머리)
+
+- §2 "편집 버퍼" bullet → 메타데이터 기반 typed 동적 폼 + 호환 키 보존 + planned 옵션 노출 + paginated 분기 설명으로 교체.
+- §9.9 (A/B 비교) 옛 KeyValueEditor + 버퍼 분리 결정을 → 옛 KeyValueEditor / 신규 메타데이터 기반 동적 폼 비교로 재작성. 옛 패턴이 본 프로젝트에서 더 이상 적용되지 않음을 명시. 호환 키 보존 결정 추가.
+- CHANGELOG `2026-05-16 (ux-cleanup)` 행 추가.
+- plan 의 Phase 3 follow-ups 모두 체크, Phase 4 §9.9 cleanup 섹션 추가, Phase 5+ (coverage 확장, 피드백 통로) 는 `cafe24-followup-backlog.md` (PR #87) 트랙으로 이전 명시.
+
+## BLOCK: NO
+
+CRITICAL false positive 해소. INFO/WARN 잔존은 본 PR 차단 사유 없음.

```

---

### 파일 11: review/consistency/2026/05/16/13_29_47/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_29_47/convention_compliance/review.md b/review/consistency/2026/05/16/13_29_47/convention_compliance/review.md
new file mode 100644
index 00000000..4df010c9
--- /dev/null
+++ b/review/consistency/2026/05/16/13_29_47/convention_compliance/review.md
@@ -0,0 +1,59 @@
+# Convention Compliance Review — Phase 4 Cafe24 spec §9.9 cleanup
+
+대상 파일:
+- `spec/4-nodes/4-integration/4-cafe24.md` (§2 fields bullet 재작성, §9.9 재작성, §10 CHANGELOG 행 추가)
+- `plan/in-progress/cafe24-node-resource-operation-ux.md` (Phase 3 follow-up 체크, Phase 4 섹션 추가, Phase 5+ 백로그 이관)
+
+세션: `review/consistency/2026/05/16/13_29_47/`
+
+---
+
+## 발견사항
+
+### 1. **[WARNING]** Plan frontmatter `worktree` 필드가 현재 Phase 4 worktree 와 불일치
+
+- **target 위치**: `plan/in-progress/cafe24-node-resource-operation-ux.md` 1–5행 (frontmatter)
+- **위반 규약**: `CLAUDE.md` §"PLAN 문서 라이프사이클" > frontmatter 메타데이터 규칙 — `worktree` 필드는 "이 plan 이 살아있는 worktree 디렉토리 이름" 을 가리켜야 한다.
+- **상세**: 현재 frontmatter 의 `worktree` 값은 `cafe24-node-ux-frontend-f5a3b8 (Phase 3, active) — Phase 1 & 2 worktrees merged & removed` 이다. Phase 4 작업은 실제로 `cafe24-spec-buffer-cleanup-2b6e9c` worktree 에서 진행 중이므로 값이 구 Phase 3 worktree 를 가리키고 있다. `consistency-checker` 의 `plan_coherence` checker 는 이 필드를 현재 활성 worktree 와 매칭하여 충돌을 검출하므로, 현재 값은 오탐(false mismatch) 을 유발할 수 있다.
+- **제안**: Phase 4 작업 진행 중이므로 frontmatter 를 아래와 같이 갱신한다.
+  ```
+  worktree: cafe24-spec-buffer-cleanup-2b6e9c
+  ```
+  Phase 3 worktree 정보는 plan 본문의 "Phase 3" 섹션 헤더 또는 주석에 이미 기술되어 있으므로 frontmatter 에서 제거해도 history 손실이 없다. 단, 동일 plan 이 Phase 연속으로 이어지는 구조임을 고려하여 frontmatter 갱신이 "Phase 4 착수" 시점을 명확히 드러내도록 한다 (규약상 "plan 이 살아있는 worktree" 는 최신 활성 worktree 를 뜻함).
+
+---
+
+### 2. **[WARNING]** CHANGELOG 참조 세션 `11_11_07` 이 파일시스템에 존재하지 않음
+
+- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §10 CHANGELOG, `2026-05-16` 행 — `consistency-check 세션: review/consistency/2026/05/16/11_11_07/`
+- **위반 규약**: `CLAUDE.md` §"정보 저장 위치 (단일 진실 원칙)" — 일관성 검토 산출물은 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 에 저장된다. 본 경로 규약은 동시에 해당 세션이 실제로 실행되었다는 증거이기도 하다.
+- **상세**: `review/consistency/2026/05/16/11_11_07/` 디렉토리가 존재하지 않는다. 해당 날짜의 세션 목록(`00_32_47`, `00_36_35`, `01_18_15`, `08_22_34`, `09_03_04`, `09_13_51`, `09_34_14`, `09_42_54`, `10_01_06`, `11_36_49`, `11_43_07`, `12_08_11`, `13_09_46`, `13_29_47`)에 `11_11_07` 이 없다. CHANGELOG 에 "(Critical 0)" 로 결과까지 기술되어 있어 부재 이유가 불명확하다 — 세션 실행 후 파일이 생성되지 않았거나, 기술 오기(예: `11_43_07` 을 `11_11_07` 로 오입력)일 수 있다.
+- **제안**: 올바른 세션 타임스탬프로 정정하거나, 세션이 실제로 실행되지 않은 경우 CHANGELOG 에서 해당 참조 구문을 제거한다. 참고로 `11_43_07` 세션은 `review/consistency/2026/05/16/11_43_07/` 에 존재하며 Phase 1 catalog sync 관련 세션이다.
+
+---
+
+### 3. **[INFO]** §9.9 내 `> 출처:` 인용 경로가 기입되어 있으나 세션 `13_09_46` 의 SUMMARY.md 존재 여부 확인 필요
+
+- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §9.9 말미 — `review/consistency/2026/05/16/13_09_46/SUMMARY.md`
+- **위반 규약**: 정식 위반은 아님. 해당 세션 디렉토리는 존재하나 (`13_09_46` 확인됨) `SUMMARY.md` 가 이미 병합되어 있는지 확인 권장.
+- **상세**: `review/consistency/2026/05/16/13_09_46/` 디렉토리는 존재하며 `SUMMARY.md` 를 포함한다 (파일시스템 확인). 링크는 유효하다.
+- **제안**: 조치 불필요.
+
+---
+
+### 4. **[INFO]** §10 CHANGELOG `2026-05-16 (ux-cleanup)` 행 — 세션 참조 경로 형식 소폭 비표준
+
+- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` §10 CHANGELOG 마지막 행, `consistency-check 세션: \`review/consistency/2026/05/16/13_29_47/\``
+- **위반 규약**: 위반은 아니나, 이전 CHANGELOG 행들(예: `2026-05-13` 행)은 `review/consistency/2026/05/13/23_22_19/` 형식을 괄호 없이 사용하고, `2026-05-16` 행은 `review/consistency/2026/05/16/11_11_07/ (Critical 0)` 처럼 괄호로 결과를 덧붙이는 혼합 스타일이 있다. `ux-cleanup` 행은 세션 경로를 인용 부호로 감싸는 점에서 소폭 다르다.
+- **상세**: 기능적으로 문제없고 경로는 유효하다. 스타일 일관성 차원의 관찰이다.
+- **제안**: 선택적 개선. 다른 행과 동일한 방식(`review/consistency/2026/05/16/13_29_47/ (Critical 0)`)으로 통일할 수 있으나 강제 사항이 아니다.
+
+---
+
+## 요약
+
+대상 문서 두 건은 전반적으로 정식 규약을 잘 준수하고 있다. spec 문서(`4-cafe24.md`)는 3섹션 구성(Overview / 본문 / Rationale)을 유지하며, §9.9 가 §9 Rationale 안에 올바르게 위치한다. 파일명 규약(`4-` prefix, `N-name.md` 패턴), §5 출력 케이스의 희소 번호(5.1/5.3/5.8) 는 통합 노드 공유 컨벤션으로 확인되어 이상 없다. cross-reference 경로(`spec/conventions/cafe24-api-catalog/_overview.md`, 각 consistency-check 세션 경로)는 대부분 파일시스템에서 유효하게 확인된다. 단, 두 가지 경고가 존재한다: (1) plan frontmatter `worktree` 필드가 Phase 3 worktree 를 가리키고 있어 `plan_coherence` checker 의 오탐을 유발할 수 있으므로 Phase 4 worktree 이름으로 갱신을 권장하고, (2) CHANGELOG 에 기록된 `11_11_07` 세션이 파일시스템에 존재하지 않아 참조 정확성 위반이다. 두 경고 모두 코드 계약이나 타 시스템의 invariant 를 직접 깨지는 않으나 규약 준수 관점에서 정정이 필요하다.
+
+## 위험도
+
+LOW

```

---

### 파일 12: review/consistency/2026/05/16/13_29_47/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_29_47/cross_spec/review.md b/review/consistency/2026/05/16/13_29_47/cross_spec/review.md
new file mode 100644
index 00000000..916c04c4
--- /dev/null
+++ b/review/consistency/2026/05/16/13_29_47/cross_spec/review.md
@@ -0,0 +1,73 @@
+# Cross-Spec 일관성 검토 — Cafe24 §2/§9.9 ux-cleanup (Phase 4)
+
+대상 변경: `spec/4-nodes/4-integration/4-cafe24.md` §2, §9.9, §10 CHANGELOG  
+검토 일시: 2026-05-16  
+세션: `review/consistency/2026/05/16/13_29_47/cross_spec/`
+
+---
+
+## 발견사항
+
+### 1. [INFO] `spec/conventions/cafe24-api-metadata.md` — §9.9 / 버퍼 패턴 직접 언급 없음, 갱신 불필요
+
+- target 위치: `4-cafe24.md` §9.9 (Fields 편집 UI 재작성)
+- 충돌 대상: `spec/conventions/cafe24-api-metadata.md` 전체
+- 상세: `cafe24-api-metadata.md` 는 메타데이터 형식(인터페이스 정의, MCP Bridge 매핑, allowlist 관계)을 다루며, 옛 KeyValueEditor/편집 버퍼 패턴을 한 번도 언급하지 않는다. `§2 Operation 메타데이터 형식`의 `fields{}` 객체 구조는 §9.9 (B) 채택안의 "메타데이터에 명시된 키만 행으로 렌더" 전제와 정합하다. §4 신규 endpoint 추가 절차(step 8: "spec 본문 수정 불요")도 4-cafe24.md 와 충돌 없다.
+- 제안: 갱신 불필요. 현재 상태로 일관성 유지.
+
+---
+
+### 2. [INFO] `spec/conventions/cafe24-api-catalog/_overview.md` — planned 항목 dropdown 노출 기술과 일치, 갱신 불필요
+
+- target 위치: `4-cafe24.md` §2 "Operation 후보 표시: `status: planned` 행도 dropdown 에 노출하되 disabled + '(지원 예정)' 접미사로 구분"
+- 충돌 대상: `spec/conventions/cafe24-api-catalog/_overview.md` §3 status enum
+- 상세: `_overview.md` §3 은 `planned` 상태를 "UI 의 Operation 드롭다운에 disabled + '지원 예정' 배지로 노출"로 명시한다. `4-cafe24.md` §2 의 "(지원 예정) 접미사"와 `_overview.md` §3 의 "'지원 예정' 배지"는 같은 의도의 표현 방식 차이(접미사 vs 배지)다. §9.9 재작성은 KeyValueEditor → 동적 폼 전환 서술에 집중하며, planned 항목 표시 자체는 변경 전·후 모두 동일하게 §2 에 명시되어 있다. 실질적 모순 없음.
+- 제안: 갱신 불필요. 다만 "접미사" vs "배지" 용어를 맞추고 싶다면 `_overview.md` §3 또는 `4-cafe24.md` §2 중 하나에 "(지원 예정) 접미사(배지)" 형태로 병기해 모호성을 제거할 수 있다. 우선순위 낮음.
+
+---
+
+### 3. [INFO] `spec/4-nodes/4-integration/0-common.md` — Cafe24 행 이미 포함, 동적 폼 세부 기술 범위 밖
+
+- target 위치: `4-cafe24.md` §2 (메타데이터 기반 동적 폼 설명 전면 교체)
+- 충돌 대상: `spec/4-nodes/4-integration/0-common.md` §5 캔버스 요약, §7 출력 구조 색인
+- 상세: `0-common.md` §5 캔버스 요약 표의 Cafe24 행 (`{resource} · {operation}`)과 §7 출력 색인의 cafe24 행은 §2 변경과 무관하다. `0-common.md` 는 공통 규약(5필드, durationMs 통일, handler 6단계 계약)만 정의하며 개별 노드의 fields 입력 방식을 기술하지 않는다. `4-cafe24.md` §2 의 fields 렌더 방식 변경(KeyValueEditor → 동적 폼)은 `0-common.md` 의 어느 규약과도 충돌하지 않는다.
+- 제안: 갱신 불필요.
+
+---
+
+### 4. [INFO] `spec/2-navigation/4-integration.md` §5.8 — §9.9 를 직접 참조하지 않으며, 동적 폼 관련 언급 없음
+
+- target 위치: `4-cafe24.md` §9.9 (Fields 편집 UI 재작성), §2 (편집 버퍼 줄 제거, 동적 폼 + 호환 키 보존 기술 추가)
+- 충돌 대상: `spec/2-navigation/4-integration.md` §5.8 Cafe24
+- 상세: `4-integration.md` §5.8 는 credentials JSONB 스키마(mall_id, app_type, access_token 등), OAuth 흐름, Rate Limit 정책, AI Agent 노출 요약을 다룬다. Fields 편집 UI 방식(KeyValueEditor vs 동적 폼)에 대한 언급이 없으므로 §9.9 재작성과 충돌 지점이 없다. §5.8 의 `config.fields` 관련 언급도 없다. 크로스 링크(`[Spec 통합 §5.8 Cafe24]`)는 `4-cafe24.md` 최상단 관련 문서 목록에서 이미 유지되고 있다.
+- 제안: 갱신 불필요.
+
+---
+
+### 5. [INFO] `spec/5-system/11-mcp-client.md` — 버퍼 패턴 무관, §9.9 재작성 영향 없음
+
+- target 위치: `4-cafe24.md` §9.9 적용 범위 변경 ("옛 편집 버퍼는 본 프로젝트에서 더 이상 사용되지 않음")
+- 충돌 대상: `spec/5-system/11-mcp-client.md` §2.3 Internal Bridge, §8.4 인증 실패 자동 status 전환
+- 상세: `11-mcp-client.md` 는 `Cafe24McpBridge.callTool(name, args)` 가 args 를 "노드 핸들러의 `fields` 와 동일하게 처리"한다고 명시한다. 이 서술은 fields 의 직렬화 형식(`Record<string, unknown>`)을 전제하며, 그 형식은 §9.9 (A) KeyValueEditor 시절에도 (B) 동적 폼 시절에도 동일하다 — backend handler 의 `config.fields` shape 자체가 바뀌지 않았고, 바뀐 것은 frontend UI 에서 사용자가 keys 를 어떻게 입력하는가이다. MCP Bridge 계층은 fields 를 그대로 위임하므로 §9.9 재작성의 영향을 받지 않는다. §8.4 의 401/403 자동 status 전환 정책도 `4-cafe24.md` §6.1 과 일치(양쪽 모두 `error(auth_failed)`)한다.
+- 제안: 갱신 불필요. 기존 일관성 확인.
+
+---
+
+### 6. [INFO] `plan/in-progress/cafe24-node-resource-operation-ux.md` — 명시적 검토 대상 아님이나 Phase 4 반영 여부 확인
+
+- target 위치: `plan/in-progress/cafe24-node-resource-operation-ux.md` Phase 4 섹션
+- 충돌 대상: `4-cafe24.md` §10 CHANGELOG `2026-05-16 (ux-cleanup)` 행
+- 상세: CHANGELOG 는 Phase 4 §9.9 cleanup 을 본 plan 에서 추적함을 명시하며, 호출자 설명에 따르면 plan 문서에 Phase 3 followups 체크 + Phase 4 §9.9 cleanup 섹션 + Phase 5+ 백로그 이전이 이미 반영되었다. 이는 plan ↔ spec CHANGELOG 사이의 이중 기록이지만 충돌이 아니라 정상 추적 패턴이다.
+- 제안: 특별 조치 불필요. plan 문서가 실제로 갱신되었다면 일관성 달성.
+
+---
+
+## 요약
+
+`4-cafe24.md` §2 와 §9.9 의 ux-cleanup 재작성은 대상 5개 문서 어느 것과도 직접 모순을 일으키지 않는다. `cafe24-api-metadata.md` 는 메타데이터 형식만 다루어 편집 버퍼 패턴을 언급조차 하지 않고, `cafe24-api-catalog/_overview.md` 의 `planned` 항목 dropdown 노출 정책은 §2 기술과 실질적으로 일치한다. `0-common.md` 는 fields 입력 방식을 정의하지 않으며, `4-integration.md` §5.8 은 credentials/OAuth에 집중하므로 동적 폼 변경의 영향권 밖이다. `11-mcp-client.md` 의 Bridge 계층은 `config.fields` shape 에 무관하게 args 를 그대로 위임하므로 변경과 독립적이다. INFO 6건은 모두 "현재 일관성 확인" 또는 "선택적 용어 통일 권장" 수준이며, 구현을 차단하거나 다른 spec 즉시 갱신을 강제하는 CRITICAL·WARNING 은 없다.
+
+---
+
+## 위험도
+
+NONE

```

---

### 파일 13: review/consistency/2026/05/16/13_29_47/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_29_47/naming_collision/review.md b/review/consistency/2026/05/16/13_29_47/naming_collision/review.md
new file mode 100644
index 00000000..f7a70d3b
--- /dev/null
+++ b/review/consistency/2026/05/16/13_29_47/naming_collision/review.md
@@ -0,0 +1,68 @@
+# Naming Collision Review — Cafe24 §9.9 UX Cleanup (Phase 4)
+
+대상 파일: `spec/4-nodes/4-integration/4-cafe24.md`
+검토 범위: §2 Fields 편집 UI 수정 + §9.9 재작성 + CHANGELOG `2026-05-16 (ux-cleanup)` 행 추가
+
+---
+
+## 발견사항
+
+- **[INFO]** `ExpressionInput` — 기존 정의와 일치, 충돌 없음
+  - target 신규 식별자: `ExpressionInput` (§2 line 57, §9.9 line 479)
+  - 기존 사용처: `spec/5-system/5-expression-language.md` §8.4.1 "ExpressionInput 컴포넌트" — 동일 컴포넌트를 동일 의미(표현식 aware 텍스트 입력 위젯)로 지칭
+  - 상세: 두 참조가 완전히 동일한 개념을 가리키고 있어 의미 충돌이 없다. §9.9 의 사용("모든 값 입력칸은 `ExpressionInput` 베이스로")은 expression-language spec 에서 정의한 컴포넌트와 일관된 호칭이다.
+  - 제안: 이상 없음. 현행 유지.
+
+- **[INFO]** `fields` — 다층적 의미로 쓰이나 컨텍스트 내 명확히 구분됨
+  - target 신규 식별자: `fields` (§9.9에서 "metatata 의 `fields[]`" 와 "config.fields" 두 의미로 사용)
+  - 기존 사용처: `spec/conventions/cafe24-api-metadata.md` §2 — `Cafe24OperationMetadata.fields` (operation 의 입력 스키마 맵), `spec/4-nodes/4-integration/4-cafe24.md` §1 — config 필드 `fields: Record<string, unknown>` (사용자 입력값)
+  - 상세: "operation 의 필드 정의 스키마(메타데이터 측)" 와 "사용자가 채운 config 값(노드 측)" 이 둘 다 `fields` 라는 동일 토큰을 사용한다. §9.9 본문은 `fields[].name` (메타데이터 측) 과 `config.fields` (노드 설정 측) 를 구별해 쓰고 있고 §2 도 같은 패턴을 따르므로 독자가 컨텍스트로 구분할 수 있다. 이 이중 의미는 이번 PR 이 처음 도입한 것이 아니며 기존 spec 전반에 이미 확립된 패턴이다.
+  - 제안: 이번 PR 범위 내 변경 사항은 기존 관례를 그대로 따르므로 추가 조치 불필요. 장기적으로 메타데이터 측을 `fieldDefs` 또는 `fieldSchema` 로 구분하면 독자 부담이 줄어들 수 있으나, 이는 별도 spec 리팩터링 범위이며 현 PR 의 충돌 문제는 아니다.
+
+- **[INFO]** `extras.operationsByResource` — 단일 참조, 기존 충돌 없음
+  - target 신규 식별자: `extras.operationsByResource` (§9.9 line 479 — Phase 2 payload 설명)
+  - 기존 사용처: spec 전체 검색 결과 `4-cafe24.md` 외에 이 키를 정의하거나 참조하는 문서 없음
+  - 상세: `extras` 네임스페이스 자체도 cafe24.md 외의 spec 문서에서 사용되지 않는다. §9.9 는 이 페이로드를 "Phase 2 의 … 페이로드" 라는 역사적 맥락으로만 언급하고 있어 현재 계약으로 오인될 우려가 낮다. 다만 `extras.operationsByResource` 가 어느 API endpoint 또는 어느 spec 섹션에서 정의되는지에 대한 명시적 링크가 없다.
+  - 제안: 혼동 방지를 위해 `extras.operationsByResource` 에 출처 참조(예: "Cafe24 노드 설정 API §X" 또는 plan 링크)를 한 줄 추가하면 좋지만, 식별자 충돌 자체는 아니므로 현 PR 차단 사유가 아니다.
+
+- **[INFO]** `메타데이터 기반 typed 동적 폼` — 한국어 기술 산문, 식별자 아님
+  - target 신규 식별자: `메타데이터 기반 typed 동적 폼` (§9.9 소제목 / CHANGELOG 라벨)
+  - 기존 사용처: 다른 spec 문서에서 동일 문자열 미사용
+  - 상세: 이 구문은 프로그래밍 식별자나 요구사항 ID 가 아닌 기술 설명 레이블이다. 충돌 대상이 아니며, `spec/conventions/cafe24-api-metadata.md` 에서 사용하는 "메타데이터 테이블" / "Operation 메타데이터" 와 동일한 개념 맥락에서 파생된 표현이다.
+  - 제안: 이상 없음.
+
+- **[INFO]** `호환 키 보존` 소제목 — 신규 heading, 중복 없음
+  - target 신규 식별자: heading "**호환 키 보존**" (§2 bullet, §9.9 볼드 단락 시작)
+  - 기존 사용처: `4-cafe24.md` 전체 및 spec 코퍼스 전체에서 동일 heading 미존재
+  - 상세: §2 에서는 bullet 의 강조 텍스트로, §9.9 에서는 볼드 단락 시작으로 사용된다. `###` 수준의 독립 heading 이 아니라 인라인 표현이므로 Markdown anchor 충돌이 없다.
+  - 제안: 이상 없음.
+
+- **[INFO]** `§9.9` anchor — 파일 내 유일, 중복 없음
+  - target 신규 식별자: `### 9.9 Fields 편집 UI — 메타데이터 기반 typed 동적 폼` (line 475)
+  - 기존 사용처: `grep "^### 9\."` 결과: §9.1 ~ §9.9 가 연속 unique. 동일 파일에 `## 9. Rationale` 는 하나뿐이며 `### 9.9` 가 새로 추가된 것으로, 이전에 같은 번호를 가진 subsection 이 없었음을 확인
+  - 상세: `4-cafe24.md` 에는 이 PR 이전에 §9.1~§9.8 까지만 존재했다. §9.9 는 순번상 신규이며 충돌 없음.
+  - 제안: 이상 없음.
+
+- **[INFO]** CHANGELOG 레이블 `2026-05-16 (ux-cleanup)` — 같은 날 기존 레이블과 구분됨
+  - target 신규 식별자: `2026-05-16 (ux-cleanup)` (CHANGELOG 테이블 행 키, line 500)
+  - 기존 사용처: 같은 CHANGELOG 테이블 내 — `2026-05-16` (bare), `2026-05-16 (후속)`, `2026-05-16 (catalog)` 총 3개가 이미 존재 (lines 497-499)
+  - 상세: 4번째 `2026-05-16` 행으로, 구분자 `(ux-cleanup)` 이 기존 `(후속)` / `(catalog)` / bare 와 완전히 다르다. Markdown 테이블에서 행 키 중복이 허용되는 구조이지만 이 프로젝트는 일자 + 괄호 수식어를 복합 레이블로 사용하고 있어 의미 구분이 명확하다. 혼동 가능성 없음.
+  - 제안: 이상 없음.
+
+- **[INFO]** `Phase 2` / `Phase 3` 참조 — cafe24 노드 UX 개편 내부 단계, spec 전체의 Phase 용어와 중복 없음
+  - target 신규 식별자: `Phase 2`, `Phase 3` (§9.9 내 역사적 맥락 참조)
+  - 기존 사용처: `spec/5-system/4-execution-engine.md` 에 "Phase 2 — Send Email + HTTP Request", "Phase 3 — 나머지 25개 핸들러", "Phase 4 — Frontend autocomplete" 가 다른 작업(Node Output Contract Unification)의 단계로 존재
+  - 상세: 두 Phase 레이블이 다른 맥락(execution engine 마이그레이션 vs. Cafe24 노드 UX 개편)에서 동일한 "Phase 2 / Phase 3" 라는 이름을 사용한다. 그러나 §9.9 에서의 참조는 해당 절의 맥락("Cafe24 UX 개편") 안에서 쓰이고 있으며, 독자가 두 계통을 혼동할 가능성이 있다.
+  - 제안: §9.9 의 Phase 참조에 `(cafe24-node-resource-operation-ux.md §Phase 2)` 처럼 plan 링크나 "(Cafe24 노드 UX 개편 Phase 2)" 수식어를 추가하면 execution engine spec 의 "Phase 2/3" 와 구분이 명확해진다. 현 PR 에서의 의미 충돌은 critical 하지 않으나 장기 문서 가독성을 위한 권고 사항이다.
+
+---
+
+## 요약
+
+§9.9 재작성과 §2 설정 UI 정리에서 도입된 신규 식별자("메타데이터 기반 typed 동적 폼", "호환 키 보존", `ExpressionInput`, `extras.operationsByResource`, `§9.9` anchor, `2026-05-16 (ux-cleanup)` 레이블)는 모두 기존 사용처와 의미 충돌이 없다. `ExpressionInput` 은 `spec/5-system/5-expression-language.md` 에서 정의된 동일 컴포넌트를 가리키며 일관되다. `fields` 는 메타데이터 측과 config 측의 이중 의미를 갖지만 이는 기존 spec 전반에 확립된 관례이며 이번 PR 이 새로 도입한 문제가 아니다. 유일한 경미한 우려는 "Phase 2 / Phase 3" 레이블이 execution engine 마이그레이션 단계와 Cafe24 UX 개편 단계를 동일 이름으로 지칭한다는 점이나, 이는 각 문서의 국소 맥락으로 독자가 충분히 구분 가능하고 CRITICAL 혼선을 유발하지 않는다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 14: review/consistency/2026/05/16/13_29_47/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_29_47/plan_coherence/review.md b/review/consistency/2026/05/16/13_29_47/plan_coherence/review.md
new file mode 100644
index 00000000..97113eb0
--- /dev/null
+++ b/review/consistency/2026/05/16/13_29_47/plan_coherence/review.md
@@ -0,0 +1,79 @@
+# Plan 정합성 검토 — Phase 4 Cafe24 Node UX Overhaul
+
+검토 대상: `spec/4-nodes/4-integration/4-cafe24.md` (§2 + §9.9 + CHANGELOG) + `plan/in-progress/cafe24-node-resource-operation-ux.md`
+worktree: `cafe24-spec-buffer-cleanup-2b6e9c`
+검토 시점: 2026-05-16
+
+---
+
+## 발견사항
+
+### [CRITICAL] `spec/4-nodes/4-integration/4-cafe24.md` 를 동시에 수정하는 두 번째 worktree 존재
+
+- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md` 전체 (§2, §9.3, §9.7, §9.9, CHANGELOG 포함)
+- **관련 plan**: `plan/in-progress/` 에는 해당 worktree plan 이 명시되어 있지 않으나, `cafe24-spec-cleanup-f4d8e2` worktree가 동일 파일을 수정 중임이 git diff 로 확인됨
+- **상세**: `git worktree list` 결과 `cafe24-spec-cleanup-f4d8e2` 브랜치(`claude/cafe24-spec-cleanup-f4d8e2`)가 활성 상태이고, `git diff main -- spec/4-nodes/4-integration/4-cafe24.md` 에서 해당 worktree가 §2 (편집 버퍼 줄 삭제), §9.3 (카탈로그 링크 재작성), §9.7 (scope 본문 이동 방식 변경), §9.9 (구 buffer-split Rationale 완전 삭제) 를 수정하고 있음. Phase 4 (`cafe24-spec-buffer-cleanup-2b6e9c`) 는 같은 파일의 §2와 §9.9를 다른 내용으로 재작성하고 있음.
+
+  구체적 충돌 지점:
+  - `cafe24-spec-cleanup-f4d8e2`: §9.9를 "내부 버퍼 분리" 구 Rationale 을 **삭제**하고 §9.7 scope 본문도 재배치함. §9.3 카탈로그 링크를 **단순화**(catalog 링크 제거, 설명 축약).
+  - `cafe24-spec-buffer-cleanup-2b6e9c` (Phase 4): §9.9를 "(A) KeyValueEditor / (B) 메타데이터 기반 동적 폼" 두 안 비교로 **신규 작성**하고 §2의 편집 버퍼 줄을 다른 방식으로 처리함. §9.3 카탈로그 링크를 **보존**.
+
+  두 worktree 모두 `spec/4-nodes/4-integration/4-cafe24.md` 를 서로 다른 방향으로 수정하고 있어 merge 시 실질적인 3-way conflict 가 발생한다.
+- **제안**: Phase 4 PR 을 먼저 머지하거나, `cafe24-spec-cleanup-f4d8e2` 를 Phase 4 기준으로 rebase 한 후 충돌을 해소해야 한다. CLAUDE.md "공유 자원 직렬화" 정책에 따라 어느 쪽 plan 이 우선하는지 명시하고 한 쪽 작업을 일시 중단한다.
+
+---
+
+### [WARNING] `cafe24-node-resource-operation-ux.md` frontmatter 의 `worktree` 필드가 Phase 4 실제 worktree 와 불일치
+
+- **target 위치**: `plan/in-progress/cafe24-node-resource-operation-ux.md` frontmatter 1–3행
+- **관련 plan**: 동일 파일 (self-reference)
+- **상세**: frontmatter 에 `worktree: cafe24-node-ux-catalog-4b8f2c (Phase 1) / cafe24-node-ux-impl-9d3e1a (Phase 2~)` 로 기재되어 있으나, Phase 4 의 실제 작업은 `cafe24-spec-buffer-cleanup-2b6e9c` worktree 에서 진행 중임. `git worktree list` 와 `cafe24-spec-buffer-cleanup-2b6e9c` 의 `git diff main` 이 이를 확인. Phase 3 frontmatter 항목(`cafe24-node-ux-frontend-f5a3b8`)도 merge 완료된 worktree임에도 여전히 기재되어 있다.
+
+  CLAUDE.md 는 "frontmatter 의 `worktree` 필드는 동시 작업 추적과 worktree 충돌 검출에 사용된다"고 명시하므로 오기가 탐지 누락을 유발한다.
+- **제안**: `cafe24-node-resource-operation-ux.md` frontmatter 를 `worktree: cafe24-spec-buffer-cleanup-2b6e9c` 로 갱신한다. 이미 merge 된 Phase 1~3 worktree 는 history 참고용 주석으로 처리하거나 제거한다.
+
+---
+
+### [WARNING] `cafe24-node-resource-operation-ux.md` 의 "Phase 4" 항목 내용이 plan 본문의 "Phase 4" 와 다름
+
+- **target 위치**: `plan/in-progress/cafe24-node-resource-operation-ux.md` "Phase 4 — Coverage 확장" 절 (line 66–69)
+- **관련 plan**: 동일 파일
+- **상세**: plan 본문의 Phase 4 는 "Planned → Supported 전환 PR" 과 "사용자 피드백 통로" 를 범위로 정의하고 있다. 그러나 호출자 설명에 따르면 현재 PR (Phase 4) 의 실제 작업 범위는 "§2 + §9.9 + CHANGELOG 정리(spec cleanup)" 이며, "Planned → Supported 전환" 등은 `cafe24-followup-backlog.md` 로 defer 되었다. plan 의 "Phase 4" 절 내용이 실제 Phase 4 PR 작업과 맞지 않아, plan 을 읽는 다음 진입자가 Phase 4 가 무엇인지 혼동할 수 있다.
+- **제안**: `cafe24-node-resource-operation-ux.md` 의 Phase 4 절을 현재 PR 의 실제 범위(§2/§9.9 spec cleanup)로 재기술하고, 원래 "Coverage 확장" 항목은 `cafe24-followup-backlog.md` 참조로 교체한다.
+
+---
+
+### [WARNING] `cafe24-spec-cleanup-f4d8e2` 에 대응하는 in-progress plan 이 `plan/in-progress/` 에 없음
+
+- **target 위치**: `plan/in-progress/` 전체 목록
+- **관련 plan**: `cafe24-spec-cleanup-f4d8e2` worktree (활성, `claude/cafe24-spec-cleanup-f4d8e2` 브랜치)
+- **상세**: 활성 worktree `cafe24-spec-cleanup-f4d8e2` 가 `spec/4-nodes/4-integration/4-cafe24.md` 를 포함한 다수 spec 파일을 수정하고 있으나, `plan/in-progress/` 에 해당 worktree 를 `worktree:` 필드로 가리키는 plan 이 존재하지 않는다. `cafe24-spec-cleanup-f4d8e2` 내부의 `plan/in-progress/` 에는 `spec-update-cafe24-fields-ui-buffer.md` 가 있지만 frontmatter `worktree: (none)` 으로 기재되어 있어 충돌 탐지에서 누락된다. CLAUDE.md 규정상 모든 in-progress plan 은 `worktree` 필드를 명시해야 한다.
+- **제안**: `cafe24-spec-cleanup-f4d8e2` 에서 진행 중인 spec 변경에 대한 plan 을 `plan/in-progress/` 에 생성(또는 기존 plan frontmatter 를 갱신)하여 worktree 필드를 `cafe24-spec-cleanup-f4d8e2` 로 설정한다.
+
+---
+
+### [INFO] `cafe24-node-resource-operation-ux.md` 의 미완 Phase 2/3 항목이 plan 에 잔존 — `complete/` 이동 불가 조건 확인
+
+- **target 위치**: `plan/in-progress/cafe24-node-resource-operation-ux.md` Phase 2 체크리스트 (line 46–55) + Phase 3 체크리스트 (line 59–65)
+- **관련 plan**: 동일 파일
+- **상세**: Phase 2 의 백엔드 구현 체크박스 9개, Phase 3 의 프런트 체크박스 6개가 모두 미체크 상태다. 호출자 설명에서 Phase 3 은 PR #88 로 merge 됐다고 하나, plan 문서에서는 Phase 3 항목이 체크되어 있지 않다. Phase 2 항목도 별도 PR로 완료됐다면 plan 을 갱신해야 한다. CLAUDE.md 분류 기준상 미체크 체크박스가 하나라도 있으면 `in-progress/` 유지가 맞으므로 현재 위치는 올바르나, 실제 완료된 항목을 체크하지 않으면 plan 상태가 현실을 반영하지 못한다.
+- **제안**: Phase 2/3 의 완료된 항목을 체크 처리하고, 아직 미완인 항목(Phase 4 consistency-check + plan-move 등)만 남긴 뒤 plan 의 현황을 반영한다.
+
+---
+
+### [INFO] `cafe24-followup-backlog.md` 가 두 worktree 에 동시 존재
+
+- **target 위치**: `plan/in-progress/cafe24-followup-backlog.md` (양쪽 worktree 모두)
+- **관련 plan**: `cafe24-backlog-e8a3b1` worktree + `cafe24-spec-buffer-cleanup-2b6e9c` worktree 양쪽 모두 동일 경로의 파일을 보유
+- **상세**: `find` 결과 `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-backlog-e8a3b1/plan/in-progress/cafe24-followup-backlog.md` 와 `.../cafe24-spec-buffer-cleanup-2b6e9c/plan/in-progress/cafe24-followup-backlog.md` 가 내용 동일. Phase 4 PR 이 머지될 때 `cafe24-followup-backlog.md` 도 포함되므로, `cafe24-backlog-e8a3b1` 의 해당 파일과 merge conflict 가 발생할 수 있다. 두 worktree 가 같은 plan 파일을 소유하고 있어 단일 진실 원칙 위배.
+- **제안**: `cafe24-followup-backlog.md` 의 정식 home 을 `cafe24-backlog-e8a3b1` 으로 지정하고, `cafe24-spec-buffer-cleanup-2b6e9c` 에서는 해당 파일을 삭제하거나 Phase 4 PR scope 외로 처리한다.
+
+---
+
+## 요약
+
+Phase 4 spec-cleanup PR 은 `spec/4-nodes/4-integration/4-cafe24.md` 의 §2/§9.9 정리를 완료하여 §9.9 follow-up 루프를 닫는 적절한 작업이다. 그러나 같은 파일을 수정하는 `cafe24-spec-cleanup-f4d8e2` worktree 가 동시에 활성화되어 있고, 해당 worktree 의 §9.3 카탈로그 링크 삭제·§9.7 재배치·§9.9 완전 삭제 방향이 Phase 4 의 변경과 서로 다른 결론을 취하고 있어 merge 시 실질적인 3-way conflict 가 불가피하다 (CRITICAL). 또한 `cafe24-node-resource-operation-ux.md` frontmatter 의 worktree 필드가 Phase 1~3 기준으로 남아 있어 Phase 4 의 실제 작업 위치(`cafe24-spec-buffer-cleanup-2b6e9c`)를 탐지하지 못한다 (WARNING). Plan 본문의 Phase 4 절 내용이 실제 PR 범위와 다른 점, `cafe24-spec-cleanup-f4d8e2` 에 대응하는 plan 의 worktree 필드 누락, `cafe24-followup-backlog.md` 의 두 worktree 중복 존재도 정리가 필요하다. 이 중 CRITICAL 항목(동시 worktree 충돌)은 CLAUDE.md "공유 자원 직렬화" 정책에 따라 두 PR 의 작업 순서를 명시적으로 직렬화하기 전에는 해소되지 않는다.
+
+## 위험도
+
+HIGH

```

---

### 파일 15: review/consistency/2026/05/16/13_29_47/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/13_29_47/rationale_continuity/review.md b/review/consistency/2026/05/16/13_29_47/rationale_continuity/review.md
new file mode 100644
index 00000000..3edd93ea
--- /dev/null
+++ b/review/consistency/2026/05/16/13_29_47/rationale_continuity/review.md
@@ -0,0 +1,65 @@
+# Rationale 연속성 검토 — Cafe24 노드 UX Phase 4 (§9.9 cleanup)
+
+검토 대상: `spec/4-nodes/4-integration/4-cafe24.md` §2 및 §9.9 재작성 (PR #89, cafe24-spec-buffer-cleanup-2b6e9c)
+기준 Rationale: 동일 파일 §9.1~§9.8, plan/complete/cafe24-fields-add-button-fix.md, plan/complete/spec-update-cafe24-fields-ui-buffer.md, review/consistency/2026/05/16/09_03_04/SUMMARY.md, review/consistency/2026/05/16/13_09_46/rationale_continuity/review.md
+
+---
+
+## 발견사항
+
+### 1. [INFO] 옛 §9.9 결정의 "기각" 처리 방식 — 번복이 아닌 범위 한정 소멸, 단 명시성 보강 권장
+
+- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md §9.9` "적용 범위 변경 (2026-05-16)" 단락
+- **과거 결정 출처**: 동일 파일 §9.9 PR #77 원문 (옛 옵션 B — "Array<{key,value}> 내부 편집 버퍼 분리"); plan/complete/cafe24-fields-add-button-fix.md §해결방향; review/consistency/2026/05/16/09_03_04 INFO 2
+- **상세**: 옛 §9.9 는 "빈 key 행이 object 변환 시 즉시 사라져 '추가' 버튼이 동작하지 않는다"는 문제를 이유로 `Array<{key,value}>` 편집 버퍼를 채택했다. 새 §9.9 는 "키가 메타데이터로 고정되므로 '추가' 버튼 자체가 없어 빈 key 행 문제가 구조적으로 소멸"이라는 근거로 이 결정의 적용 범위가 사라졌음을 선언한다. 이는 기각된 대안의 재도입이 아니라 선결 조건 자체가 제거된 것으로, Rationale 번복이 아닌 Rationale 진부화(obsolescence) 선언이다. 새 §9.9 는 이 사실을 "적용 범위 변경" 단락에서 명시하고 있어 원칙적으로 적절하다. 단, "옛 'object-shaped contract + 편집 버퍼' 패턴은 본 프로젝트에서 더 이상 사용되지 않는다"는 문장이 cafe24 노드에만 한정되는지 아니면 프로젝트 전체에서 선언하는 것인지 독자에 따라 해석이 갈릴 수 있다. http_request 의 headers/queryParams 는 `KeyValue[]` (배열 직렬화)로서 object 변환이 없어 패턴 대상이 아니지만, 문장 표현상 이 점이 명확하지 않다.
+- **제안**: "옛 패턴은 본 프로젝트에서 더 이상 사용되지 않는다" 문장 뒤에 "(다른 통합 노드의 headers/queryParams 는 `KeyValue[]` 배열 직렬화로 처음부터 해당 없음)" 등 소괄호 보충을 추가하면 다른 노드 작업자의 혼동을 방지할 수 있다.
+
+---
+
+### 2. [INFO] 옛 §9.9 가 채택한 옵션 기호(A/B)의 재사용 — 의미 불연속 위험 낮음, 단 독자 주의 필요
+
+- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md §9.9` 옵션 (A) / (B) 정의
+- **과거 결정 출처**: 동일 §9.9 PR #77 원문 — 옛 (A) = "config.fields 를 React state 직접 사용", 옛 (B) = "내부 Array<{key,value}> 편집 버퍼 분리"
+- **상세**: 새 §9.9 는 같은 (A)/(B) 기호를 전혀 다른 맥락으로 재정의한다: 새 (A) = "자유 key/value 행 입력 (옛 KeyValueEditor 패턴)", 새 (B) = "메타데이터 기반 동적 폼". 재작성이므로 재정의 자체는 적법하나, CHANGELOG 상에서 PR #77 의 "내부 버퍼 분리" 결정이 §2 에 한 줄로 추가됐다고 기록하고 있고 plan/complete/spec-update-cafe24-fields-ui-buffer.md 도 옛 결정을 "작업 완료"로 마감했기 때문에, 기존 문서를 참조하는 독자가 §9.9 를 읽으면서 옛 (A)→(B) 결정과 새 (A)→(B) 결정을 혼용할 가능성이 있다. 실질적 Rationale 충돌은 없으나 추적 가독성에서 혼동 위험이 존재한다.
+- **제안**: §9.9 첫 줄에 "(PR #77 의 편집 버퍼 결정을 대체한다. 이하 (A)/(B) 는 위 PR 의 옵션과 무관한 새 비교 축이다)" 정도의 메모를 추가하면 이력 추적 시 혼동이 방지된다.
+
+---
+
+### 3. [INFO] "호환 키 보존" 결정 — 과거 Rationale 에 충돌 없음, 신규 결정 근거 기록 적절
+
+- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md §9.9` 마지막 단락 "호환 키 보존 (Phase 3 추가 결정)" 및 §2 "호환 키 보존" 불릿
+- **과거 결정 출처**: 동일 파일 §9.1~§9.8 전체 — 어떤 항목도 operation 변경 시의 fields 처리 정책을 다루지 않았음
+- **상세**: "operation 변경 시 교집합 키만 보존, resource 변경 시 전체 reset"이라는 결정은 이 PR 에서 새로 추가되는 신규 결정이다. 과거 Rationale 에 이와 대립하거나 다른 정책을 선언한 항목이 없으므로 기각된 대안의 재도입이나 합의된 원칙 위반에 해당하지 않는다. 결정 배경(사용자가 점진 전환 시 공통 키를 다시 입력하지 않아도 되는 편의)과 trade-off(의미 단절이 큰 resource 변경은 전체 reset)가 §9.9 에 기재되어 있으며 양방향 결정이 모두 설명되어 있다. 또한 review/consistency/2026/05/16/13_09_46/SUMMARY.md INFO 에서 "Phase 4 후속 항목으로 위임"이라고 명시된 spec 갱신이 이 PR 에서 적절히 이행되었다.
+- **제안**: 변경 없음. 출처 인용(`review/consistency/2026/05/16/09_03_04/SUMMARY.md`, `review/consistency/2026/05/16/13_09_46/SUMMARY.md`)이 §9.9 말미에 기재되어 있어 추적 가능성이 충분하다.
+
+---
+
+### 4. [INFO] §2 재작성 — §1 config 스키마 및 §4 실행 로직과의 정합성 확인
+
+- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md §2` 설정 UI, 특히 "호환 키 보존" 불릿, "planned 옵션 노출" 불릿, "Pagination 분기" 불릿
+- **과거 결정 출처**: 동일 파일 §1 (config.fields: `Record<string, unknown>`, config.pagination: optional), §4 실행 로직 step 1·5·8
+- **상세**:
+  - **호환 키 보존** (§2 불릿) — §1 의 `fields: Record<string, unknown>` 계약과 충돌하지 않는다. 교집합 키 보존은 frontend UI 동작이며 backend 계약을 변경하지 않는다. §4 step 5 (requiredFields 검증)가 교집합 누락 시 `CAFE24_MISSING_FIELDS` 로 잡으므로 실행 안전성에도 문제없다.
+  - **planned 옵션 표시** (§2 불릿) — §4 step 1 에서 메타데이터 미존재 시 `CAFE24_UNKNOWN_OPERATION` throw 로 정의되어 있고, §2 는 "planned 선택 시 fields/pagination 미렌더"로 사용자가 실행을 시도하지 않도록 유도한다. UI 방어와 실행 에러 양쪽이 일치한다.
+  - **Pagination 분기** (§2 불릿) — §1 의 `pagination: object?` (optional)과 정합하며, §4 step 8 ("pagination.{limit, offset, cursor} 는 항상 query") 과 충돌하지 않는다. 미지원 operation 에서 pagination 을 숨기는 것은 spec 초안(§2 mock)에서 이미 의도된 바이다.
+  - 정합성 이슈는 발견되지 않는다.
+- **제안**: 변경 없음.
+
+---
+
+### 5. [INFO] CHANGELOG "ux-cleanup" 행 — "버퍼 패턴을 완전히 폐기"라는 표현의 정확성
+
+- **target 위치**: `spec/4-nodes/4-integration/4-cafe24.md §10 CHANGELOG` "2026-05-16 (ux-cleanup)" 행
+- **과거 결정 출처**: 동일 파일 CHANGELOG "2026-05-16 (후속)" 행 — "§9.9 (Fields 편집 UI 의 내부 버퍼 분리) 신설 (PR #62 후속)"으로 옛 §9.9 를 "신설"로 기록
+- **상세**: CHANGELOG "ux-cleanup" 행은 "옛 §9.9 의 'object-shaped contract + 편집 버퍼' 패턴은 본 프로젝트에서 더 이상 사용되지 않음을 명시"라고 적고 있다. 이 표현은 `plan/complete/spec-update-cafe24-fields-ui-buffer.md` 에서 "작업 완료"로 처리된 PR #77 의 spec 변경과 본 PR 의 §9.9 재작성 두 단계를 거쳤음을 충분히 추적할 수 있어 허위 기록이 아니다. 다른 §9.x 섹션 (§9.1~§9.8) 에서 "편집 버퍼" 또는 "KeyValueEditor" 를 참조하는 문장은 발견되지 않아 잔존 참조로 인한 혼동 위험도 없다.
+- **제안**: 변경 없음.
+
+---
+
+## 요약
+
+Phase 4 의 §2·§9.9 재작성은 Rationale 연속성 관점에서 기각된 대안의 재도입, 합의된 invariant 위반, 근거 없는 결정 번복, 암묵적 가정 충돌 어느 것도 해당하지 않는다. 핵심 전환점인 "옛 Array 버퍼 결정의 소멸"은 선결 조건(KeyValueEditor + 자유 key 입력 UX) 이 Phase 3 구현으로 구조적으로 제거되었음을 올바르게 설명한다. 신규 추가된 "호환 키 보존" 결정도 기존 §1 config 스키마·§4 실행 로직과 충돌하지 않으며 과거 Rationale 의 어떤 항목도 이와 대립하지 않는다. 발견사항 5건 전부 INFO 수준 — 독자 가독성·이력 추적 편의를 위한 문장 보강 제안이며, 구현 또는 spec 적용 차단 사유가 없다.
+
+## 위험도
+
+NONE

```

---

### 파일 16: review/consistency/2026/05/16/14_06_49/SUMMARY.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_06_49/SUMMARY.md b/review/consistency/2026/05/16/14_06_49/SUMMARY.md
new file mode 100644
index 00000000..a81a520d
--- /dev/null
+++ b/review/consistency/2026/05/16/14_06_49/SUMMARY.md
@@ -0,0 +1,28 @@
+# Consistency Check 통합 보고서 — HMAC raw-value 재정정 draft
+
+**BLOCK: NO** (3 Critical 모두 false positive / spec-first workflow 정상 단계)
+
+- 대상: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md`
+- 모드: spec draft (--spec)
+- 검토 일시: 2026-05-16T14:06:49
+- Checker: 5/5 success
+
+## Critical 분석
+
+| # | Checker | 발견 | 분류 | 조치 |
+|---|---------|------|------|------|
+| 1 | cross_spec | CHANGELOG/Rationale 삽입 앵커 "Cafe24 App URL 상세 페이지 표시" 부재 | **False positive** — checker corpus 가 PR #89 머지 전 상태. 실제로는 spec/2-navigation/4-integration.md line 1152 에 존재 | 없음 (draft 유지) |
+| 2 | cross_spec | spec 정정과 백엔드 구현 불일치 | **Spec-first workflow 정상 단계** — 본 PR 의 다음 단계 (developer skill) 가 코드 동기 수정 예정 (`buildHmacMessage`, `formUrlEncode` 제거) | 본 PR 하나로 spec+code+test 동시 머지 |
+| 3 | cross_spec | self-fulfilling HMAC 테스트가 신규 spec 검증 못 함 | **Spec-first workflow 정상 단계** — developer skill 이 `formUrlEncodeForTest` 헬퍼 제거 + 사용자 실제 URL 회귀 테스트 추가 | 동일 PR 의 테스트 단계 |
+
+## Warning / Info
+
+cross_spec / convention_compliance / plan_coherence / naming_collision 의 Warning · Info 항목 대부분이 위 3 Critical 의 부산 — spec 정정 후 backend `buildHmacMessage` 구현 / `formUrlEncodeForTest` 헬퍼 / `accepts HMAC for queries containing space-encoded values` 테스트의 동기 수정 필요. 모두 본 PR 의 developer 단계에서 처리.
+
+rationale_continuity: Critical 0. 옛 SEC H-1 결정 (2026-05-16) 의 번복이지만 명확한 신규 증거 (사용자 실제 URL `%20`) 기반이라 결정 합리성 인정.
+
+naming_collision: 신규 식별자 없음 (`buildHmacMessage` 시그니처 동일 유지, `formUrlEncode` 제거).
+
+## 결론
+
+draft 를 spec 본문에 반영 진행. developer skill 이 후속해서 코드+테스트 동기화.

```

---

### 파일 17: review/consistency/2026/05/16/14_06_49/_prompts/convention_compliance.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_06_49/_prompts/convention_compliance.md b/review/consistency/2026/05/16/14_06_49/_prompts/convention_compliance.md
new file mode 100644
index 00000000..823d9736
--- /dev/null
+++ b/review/consistency/2026/05/16/14_06_49/_prompts/convention_compliance.md
@@ -0,0 +1,459 @@
+# 정식 규약 준수 Check Payload
+
+본 파일은 orchestrator 가 정식 규약 준수 checker 용으로 작성한 입력입니다. target 문서가 정식 규약(`spec/conventions/**`) 을 따르고 있는지 분석한다.
+sub-agent 의 system prompt 에 정의된 호출 규약·등급 기준·출력 형식을 그대로
+따르되, 분석 시 아래 "점검 관점" 을 빠짐없이 적용하세요. 결과는 `output_file`
+인자에 review.md 로 Write 하고 호출자에게는 STATUS 한 줄만 반환합니다.
+
+## 점검 관점 (정식 규약 준수)
+
+1. **명명 규약** — 파일·식별자·API endpoint 명명이 conventions 규칙과 일치하는가
+2. **출력 포맷 규약** — 노드 Output, API 응답, error code 형식 등이 정식 규약을 따르는가
+3. **문서 구조 규약** — Overview / 본문 / Rationale 3섹션 권장, `_product-overview.md`·`0-` prefix 등 CLAUDE.md 의 명명 컨벤션 준수
+4. **API 문서 규약** — Swagger 패턴·request/response DTO 명명
+5. **금지 항목** — conventions 에서 명시적으로 금지한 패턴(예: 옛 prd/, memory/ 경로 사용)을 답습하고 있지 않은가
+
+## 검토 모드
+spec draft 검토 (--spec)
+
+## Target 문서
+경로: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md`
+
+```
+---
+worktree: cafe24-hmac-raw-fix-b8e2d1
+started: 2026-05-16
+owner: project-planner
+spec_files:
+  - spec/4-nodes/4-integration/4-cafe24.md
+  - spec/2-navigation/4-integration.md
+---
+
+# Spec Draft — Cafe24 HMAC 알고리즘 재정정 (Critical 운영 결함)
+
+## 배경
+
+PR #67 (2026-05-16 SEC H-1) 의 "Java URLEncoder 호환 (공백 `+`)" 가정이 오류였다. 사용자가 신규 Cafe24 Private 통합을 등록 직후에도 `CAFE24_INSTALL_INVALID_HMAC` 발생. 진단 로그는 `reason=hmac_verify_failed urlMallId=gehrig0301 dbMallId=gehrig0301 dbAppType=private` 으로 명확 — mall_id / app_type / install_token / client_secret 모두 매칭하는데 HMAC 자체만 불일치.
+
+증거:
+- 사용자 URL: `user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90` (Cafe24 가 공백을 `%20` 으로 인코딩)
+- 우리 옛 알고리즘: `URLSearchParams` decode → `formUrlEncode` 로 `+` 인코딩 → 메시지 안에 `+`
+- Cafe24 의 실제 알고리즘 (Java 샘플): URL value 를 raw 그대로 (`%20` 그대로) HMAC 메시지에 사용
+
+→ **Cafe24 는 URLEncoder 를 호출하지 않는다. URL 의 raw byte 를 그대로 보존한다.**
+
+---
+
+## 변경 1 — `spec/4-nodes/4-integration/4-cafe24.md` §9.8 알고리즘 본문 정정
+
+**위치**: §9.8 Private 앱 App URL HMAC 검증, "알고리즘" 단계 2
+
+**옛 텍스트** (현재 line 429):
+> 2. **form-urlencoded** query string 형태로 직렬화: `key=URLencoded-value&...`. 값 인코딩은 Java `URLEncoder.encode(value, "UTF-8")` 호환 — `application/x-www-form-urlencoded` MIME 규약 (공백 → `+`).
+
+**새 텍스트**:
+> 2. **원본 URL-encoded 값을 그대로 보존** 해서 query string 형태로 직렬화: `key=raw-value&...`. **decode/re-encode 금지** — Cafe24 의 공식 Java 샘플 `validationCheckHmac` 는 `request.getQueryString()` 을 `&` 로 split 한 뒤 `=` 로 한 번만 split 해서 value 부분을 **raw 그대로** TreeMap 에 저장한다. 즉 Cafe24 가 URL 에 `%20` 으로 보냈으면 HMAC 메시지에도 `%20`, `+` 로 보냈으면 `+` 그대로 유지된다. value 의 의미를 해석하지 않고 byte 단위로 매칭하는 게 정답. **재정정 배경**은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항 참조.
+
+**옛 코드 예시** (line 434-458 의 `formUrlEncode` + `URLSearchParams` 사용 예제):
+- 통째로 제거
+
+**새 코드 예시**:
+```typescript
+function buildHmacMessage(rawQuery: string): string {
+  return rawQuery
+    .split('&')
+    .map((part) => {
+      const eqIdx = part.indexOf('=');
+      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
+      return { key, raw: part };
+    })
+    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
+    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
+    .map((p) => p.raw)
+    .join('&');
+}
+
+function verifyHmac(rawQuery: string, clientSecret: string, receivedHmac: string): boolean {
+  const message = buildHmacMessage(rawQuery);
+  const computed = createHmac('sha256', clientSecret).update(message, 'utf8').digest('base64');
+  return timingSafeEqual(Buffer.from(computed), Buffer.from(receivedHmac));
+}
+```
+
+---
+
+## 변경 2 — `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG 행 추가
+
+**위치**: §10 CHANGELOG 표 끝
+
+**추가할 행** (기존 `2026-05-16 (ux-cleanup)` 행 다음):
+
+```
+| 2026-05-16 (hmac-raw-fix) | §9.8 HMAC 검증 알고리즘 **재정정** — PR #67 SEC H-1 의 "Java URLEncoder 호환 (공백 `+`)" 가정이 오류였음. Cafe24 공식 샘플은 URL 의 값을 decode/re-encode 없이 raw 그대로 HMAC 메시지에 사용한다 (`request.getQueryString()` split → TreeMap 보존). 운영 사용자 보고 (2026-05-16) — Cafe24 가 URL 에 `%20` 으로 공백을 인코딩해 보내는데 우리는 `+` 로 변환해 메시지 불일치. raw-value 보존 방식으로 재정정. 자세한 결정 배경은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항. |
+```
+
+---
+
+## 변경 3 — `spec/2-navigation/4-integration.md` Rationale 신규 항
+
+**위치**: `## Rationale` 섹션 말미, 현재 마지막 항 "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" 다음에 추가.
+
+**본문**:
+
+```markdown
+### HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)
+
+PR #67 의 SEC H-1 (2026-05-16) 가 HMAC 검증을 "Java `URLEncoder.encode(value, "UTF-8")` 호환 (공백 `+`)" 으로 정정했으나, 운영 환경에서 **신규 통합 직후 즉시 HMAC 실패** 가 재현됐다 (사용자 보고, 2026-05-16). HMAC 진단 로그가 `reason=hmac_verify_failed` 를 정확히 식별 — mall_id / app_type / install_token / client_secret 모두 매칭하는데 HMAC 자체만 불일치.
+
+**근본 원인**: Cafe24 의 공식 `validationCheckHmac` Java 샘플은 `request.getQueryString()` 을 `&` 로 split → `=` 로 한 번만 split → TreeMap 에 **raw value 그대로** 저장한 뒤 concat 한다. 즉 **URL value 를 decode 하지 않으며 re-encode 도 하지 않는다**. 우리 SEC H-1 fix 는 "Cafe24 가 URLEncoder 를 호출한다" 라고 가정했지만, 실제로는 URL 의 raw byte sequence 를 그대로 HMAC 메시지에 넣는다.
+
+**증거**: 사용자 보고 URL 의 `user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90` — Cafe24 가 공백을 `%20` 으로 보낸다. 만약 Cafe24 가 HMAC 계산에 URLEncoder 를 호출한다면 메시지 안의 값은 `%EB%8C%80%ED%91%9C+%EA%B4%80%EB%A6%AC%EC%9E%90` 가 되어야 하고, 그 결과 Cafe24 자신의 HMAC 도 자기네 URL 과 매칭이 안 되어 검증이 동작하지 않을 것이다. 따라서 Cafe24 는 raw 값을 사용한다 (이론적 추론 + 운영 재현 동시 확인).
+
+**해결**: `buildHmacMessage` 가 `URLSearchParams` 로 decode 하지 않고 `rawQuery.split('&')` 로 직접 파싱해 key/value 의 raw byte string 을 그대로 보존한다. sort 는 key 만 알파벳 순. value 인코딩은 Cafe24 가 어떤 인코더로 URL 을 만들었든 무관 — byte 단위로 일치하기만 하면 된다.
+
+```typescript
+function buildHmacMessage(rawQuery: string): string {
+  return rawQuery
+    .split('&')
+    .map((part) => {
+      const eqIdx = part.indexOf('=');
+      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
+      return { key, raw: part };
+    })
+    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
+    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
+    .map((p) => p.raw)
+    .join('&');
+}
+```
+
+**기각된 옵션 (raw 보존 대신 다양한 인코더 시도)**: `encodeURIComponent` / `URLEncoder` 호환 / browser fetch encoding 등 후보 인코더가 매번 차이가 있어 (`%20` vs `+`, `*` vs `%2A`, `!` vs `%21` 등) 어느 하나로 매칭이 보장되지 않는다. Cafe24 자체도 향후 인코더를 바꿀 수 있다. raw byte 보존은 인코더 invariant 다.
+
+**보안 영향 없음**: HMAC 자체의 cryptographic strength 는 변하지 않는다. capability-token 보호 ([Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제"](#cafe24_install_invalid_token404-의-보안-전제-2026-05-14)) 도 그대로. 옛 PR #67 의 SEC H-2 (workspace 횡단 enumeration 방지) 도 그대로.
+
+**테스트 보강**: 사용자 실제 URL (`user_name=...%20...` + 실제 timestamp + 실제 hmac) 의 회귀 보호 테스트 추가. 옛 `accepts HMAC for queries containing space-encoded values` 테스트는 `John+Doe` 형식을 사용했으나 — 그건 우리 옛 알고리즘의 self-fulfilling 검증 (compute 와 verify 가 같은 broken 알고리즘 사용) 이라 실제 Cafe24 동작 검증이 안 됐다. 새 테스트는 **Cafe24 가 보내는 형식 (`%20`) 그대로** raw query 를 만들어 검증한다.
+
+**관련 history**:
+- 2026-05-14: HMAC 알고리즘 최초 도입 (`encodeURIComponent` 사용, 운영 양호)
+- 2026-05-16 (PR #67 SEC H-1): `formUrlEncode` 로 변경 (잘못된 가정에 기반한 회귀)
+- 2026-05-16 (본 결정): raw-value 보존으로 재정정 (Cafe24 실제 동작 반영)
+```
+
+---
+
+## 정합성 self-check
+
+- [x] 변경 1 의 새 코드 예시는 변경 3 의 Rationale 코드와 동일 (동기 유지)
+- [x] 변경 2 CHANGELOG 행이 변경 3 Rationale 항을 링크
+- [x] `formUrlEncode` 헬퍼는 spec 본문 외 다른 인용 없음 (grep 확인)
+- [x] `buildHmacMessage` 시그니처 (인자: `rawQuery: string`, 반환: `string`) 호환 — 호출자 (`handleInstall`, `tryRecoverByMallId`) 변경 불필요
+- [x] PR #67 SEC H-2 (`tryRecoverByMallId` workspace 횡단 방지) 와 무관 — 본 변경은 message 빌드 알고리즘만 정정
+- [x] capability-token 보안 전제 무영향 — install_token 형식 / TTL / 보존 정책 변경 없음
+
+```
+
+## 정식 규약 모음 (spec/conventions/)
+
+### spec/conventions 정식 규약
+
+#### `spec/conventions/cafe24-api-catalog/_overview.md`
+```
+# CONVENTION: Cafe24 API Catalog — Overview
+
+> 관련 문서: [Spec Cafe24 노드](../../4-nodes/4-integration/4-cafe24.md) · [Cafe24 API Metadata 컨벤션](../cafe24-api-metadata.md) · [Cafe24 공식 Admin API 문서](https://developers.cafe24.com/docs/ko/api/admin/)
+
+본 디렉토리(`spec/conventions/cafe24-api-catalog/`) 는 Cafe24 Admin API 의 **모든 endpoint** 를 18 resource 단위로 enumerate 한 단일 진실(single source of truth)이다. 노드 메타데이터(`backend/src/nodes/integration/cafe24/metadata/*.ts`) 가 어디까지 구현됐고 어디가 남았는지가 한 화면에서 보이도록 유지한다.
+
+---
+
+## 1. 디렉토리 구조
+
+```
+spec/conventions/cafe24-api-catalog/
+  _overview.md        # 본 문서 — 인덱스 + 컬럼 정의 + 동기 정책 + coverage matrix
+  store.md            # Store (상점) — 50+ sub-resource
+  product.md          # Product (상품)
+  order.md            # Order (주문)
+  customer.md         # Customer (회원)
+  community.md        # Community (게시판)
+  design.md           # Design (디자인)
+  promotion.md        # Promotion (프로모션)
+  application.md      # Application (앱 관리)
+  category.md         # Category (상품분류)
+  collection.md       # Collection (판매분류)
+  supply.md           # Supply (공급사)
+  shipping.md         # Shipping (배송)
+  salesreport.md      # Salesreport (매출통계)
+  personal.md         # Personal (개인화)
+  privacy.md          # Privacy (개인정보)
+  mileage.md          # Mileage (적립금)
+  notification.md     # Notification (알림)
+  translation.md      # Translation (번역)
+```
+
+resource 이름은 `Cafe24Resource` enum (`backend/src/nodes/integration/cafe24/metadata/types.ts`) 와 1:1 일치한다.
+
+## 2. 표 컬럼 정의
+
+각 resource 파일은 다음 컬럼의 표를 가진다.
+
+| 컬럼 | 필수 | 설명 |
+|------|------|------|
+| `id` | ✓ | 노드 메타데이터의 operation id. `<resource>_<verb>` 또는 `<resource>_<sub>_<verb>` (예: `product_list`, `product_options_create`). 영문 snake_case, resource 내 unique |
+| `라벨 (한)` | ✓ | UI 드롭다운에 노출되는 한국어 라벨 (예: "상품 목록 조회") |
+| `English title` | ✓ | Cafe24 공식 docs 의 영문 제목 (예: "Retrieve a list of products") |
+| `method` | supported 시 ✓ | `GET` / `POST` / `PUT` / `DELETE`. planned 시 `?` 허용 |
+| `path` | supported 시 ✓ | path template (예: `products/{product_no}`). `/api/v2/admin/` 접두는 생략. planned 시 `?` 허용 |
+| `scope` | supported 시 ✓ | `read` / `write`. `mall.<scope>_<resource>` 의 가운데 토큰. planned 시 `?` 허용 |
+| `paginated` | — | `✓` 또는 빈 칸. `paginated: true` 인 operation 만 표시 |
+| `status` | ✓ | §3 의 enum 중 하나 |
+| `docs` | ✓ | Cafe24 공식 docs anchor URL — `https://developers.cafe24.com/docs/ko/api/admin/#<anchor>` |
+
+## 3. status enum
+
+| 값 | 의미 | 백엔드 메타데이터 |
+|-----|------|------|
+| `supported` | 노드/MCP Bridge 에서 호출 가능 | `CAFE24_OPERATIONS_BY_RESOURCE[resource]` 에 row 존재 |
+| `planned` | 카탈로그에 등재만, 미구현. UI 의 Operation 드롭다운에 **disabled + "지원 예정" 배지** 로 노출 | row 없음 |
+| `deprecated` | Cafe24 가 제거 또는 deprecate 했고 우리 노드에서도 더 이상 호출 안 함 | row 없으면 정상. 있으면 마이그레이션 대상 |
+
+`planned` 행의 `method`/`path`/`scope` 가 `?` 인 경우, 구현 시점에 공식 docs 를 다시 검증한 뒤 `supported` 로 승격시키며 정확한 값으로 갱신한다.
+
+## 4. 동기 정책 (Sync Contract)
+
+본 카탈로그는 `backend/src/nodes/integration/cafe24/metadata/*.ts` 와 **양방향 동기 테스트**로 보호된다.
+
+**테스트 위치**: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`
+
+**검증 규칙**:
+
+1. **`supported` row → 메타데이터 존재**: 카탈로그에 `status: supported` 로 적힌 모든 `(resource, id)` 가 `findCafe24Operation(resource, id)` 로 조회되어야 한다. 누락 시 fail.
+2. 

... (truncated due to prompt size limit) ...

---

### 파일 18: review/consistency/2026/05/16/14_06_49/_prompts/cross_spec.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 19: review/consistency/2026/05/16/14_06_49/_prompts/naming_collision.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 20: review/consistency/2026/05/16/14_06_49/_prompts/plan_coherence.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 21: review/consistency/2026/05/16/14_06_49/_prompts/rationale_continuity.md
- 변경 유형: Review
- 언어: md


... (diff omitted due to prompt size limit) ...

---

### 파일 22: review/consistency/2026/05/16/14_06_49/_retry_state.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_06_49/_retry_state.json b/review/consistency/2026/05/16/14_06_49/_retry_state.json
new file mode 100644
index 00000000..f78ccc53
--- /dev/null
+++ b/review/consistency/2026/05/16/14_06_49/_retry_state.json
@@ -0,0 +1,58 @@
+{
+  "session_dir": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-hmac-raw-fix-b8e2d1/review/consistency/2026/05/16/14_06_49",
+  "summary_subagent_type": "consistency-summary",
+  "summary_output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-hmac-raw-fix-b8e2d1/review/consistency/2026/05/16/14_06_49/SUMMARY.md",
+  "subagent_invocations": [
+    {
+      "name": "cross_spec",
+      "subagent_type": "cross-spec-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-hmac-raw-fix-b8e2d1/review/consistency/2026/05/16/14_06_49/_prompts/cross_spec.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-hmac-raw-fix-b8e2d1/review/consistency/2026/05/16/14_06_49/cross_spec/review.md"
+    },
+    {
+      "name": "rationale_continuity",
+      "subagent_type": "rationale-continuity-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-hmac-raw-fix-b8e2d1/review/consistency/2026/05/16/14_06_49/_prompts/rationale_continuity.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-hmac-raw-fix-b8e2d1/review/consistency/2026/05/16/14_06_49/rationale_continuity/review.md"
+    },
+    {
+      "name": "convention_compliance",
+      "subagent_type": "convention-compliance-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-hmac-raw-fix-b8e2d1/review/consistency/2026/05/16/14_06_49/_prompts/convention_compliance.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-hmac-raw-fix-b8e2d1/review/consistency/2026/05/16/14_06_49/convention_compliance/review.md"
+    },
+    {
+      "name": "plan_coherence",
+      "subagent_type": "plan-coherence-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-hmac-raw-fix-b8e2d1/review/consistency/2026/05/16/14_06_49/_prompts/plan_coherence.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-hmac-raw-fix-b8e2d1/review/consistency/2026/05/16/14_06_49/plan_coherence/review.md"
+    },
+    {
+      "name": "naming_collision",
+      "subagent_type": "naming-collision-checker",
+      "prompt_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-hmac-raw-fix-b8e2d1/review/consistency/2026/05/16/14_06_49/_prompts/naming_collision.md",
+      "output_file": "/Volumes/project/private/clemvion/.claude/worktrees/cafe24-hmac-raw-fix-b8e2d1/review/consistency/2026/05/16/14_06_49/naming_collision/review.md"
+    }
+  ],
+  "agents_pending": [],
+  "agents_success": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ],
+  "agents_fatal": [],
+  "agent_history": {
+    "cross_spec": [{"status": "success", "issues": 7}],
+    "rationale_continuity": [{"status": "success", "issues": 3}],
+    "convention_compliance": [{"status": "success", "issues": 3}],
+    "plan_coherence": [{"status": "success", "issues": 3}],
+    "naming_collision": [{"status": "success", "issues": 5}]
+  },
+  "rate_limit_episodes": 0,
+  "total_wait_sec": 0,
+  "wake_history": [],
+  "last_reset_hint_sec": null,
+  "loop_mode": false
+}
\ No newline at end of file

```

---

### 파일 23: review/consistency/2026/05/16/14_06_49/convention_compliance/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_06_49/convention_compliance/review.md b/review/consistency/2026/05/16/14_06_49/convention_compliance/review.md
new file mode 100644
index 00000000..9eab911c
--- /dev/null
+++ b/review/consistency/2026/05/16/14_06_49/convention_compliance/review.md
@@ -0,0 +1,39 @@
+# 정식 규약 준수 Review
+
+대상: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md`
+검토 모드: spec draft 검토 (--spec)
+검토 일시: 2026-05-16
+
+---
+
+## 발견사항
+
+- **[INFO]** plan 문서가 spec 문서가 아닌 plan/in-progress/ 에 위치하는 것은 적합하나, 문서 제목이 "Spec Draft" 로 혼재
+  - target 위치: 문서 제목 `# Spec Draft — Cafe24 HMAC 알고리즘 재정정 (Critical 운영 결함)`
+  - 위반 규약: `CLAUDE.md` 명명 컨벤션 — `plan/in-progress/<name>.md` 는 "처리할 항목이 남은 plan" 이며, spec 문서는 `spec/<영역>/*.md` 에 위치해야 한다. plan 파일이 spec draft 내용을 담는 형식은 허용되지만 제목에 "Spec Draft" 를 사용하면 문서 성격이 모호해진다.
+  - 상세: 파일이 `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 에 있고 frontmatter 의 `spec_files` 키로 수정 대상 spec 파일을 명시하는 구조는 이 프로젝트에서 통용되는 패턴이다. 그러나 `# Spec Draft` 라는 제목은 본 문서 자체가 spec 초안인 것처럼 읽혀 `plan/` vs `spec/` 의 경계를 흐릴 수 있다.
+  - 제안: 제목을 `# Plan — Cafe24 HMAC 알고리즘 재정정 (spec 변경 내역 포함)` 과 같이 plan 성격임을 명시하거나, 현재 관행이 프로젝트 표준이라면 명명 컨벤션 테이블에 `spec-draft-<name>.md` 패턴을 명시적으로 추가하는 것을 권장한다.
+
+- **[INFO]** frontmatter 에 `spec_files` 키 사용 — CLAUDE.md 의 공식 frontmatter 스키마 외 확장 키
+  - target 위치: frontmatter `spec_files:` 블록 (lines 8-10 of target)
+  - 위반 규약: `CLAUDE.md` §PLAN 문서 라이프사이클 — 공식 frontmatter 스키마는 `worktree`, `started`, `owner` 세 키만 명시한다.
+  - 상세: `spec_files` 키는 정식 스키마에 없다. 현재 구조에서는 일관성 검토 시 `plan_coherence` checker 가 이 키를 파싱하지 않을 가능성이 있다.
+  - 제안: (a) `spec_files` 를 정식 frontmatter 스키마에 추가하도록 CLAUDE.md 또는 `spec/conventions/` 내 plan 규약 문서를 갱신하거나, (b) spec 파일 목록을 본문 내 별도 섹션(`## 수정 대상 spec 파일`)으로 옮겨 frontmatter 를 공식 3키로 유지한다.
+
+- **[INFO]** Rationale 항 cross-link 가 상대 경로로 작성됨 — 가독성은 양호하나 worktree 외부에서 렌더링 시 경로 불일치 위험
+  - target 위치: 변경 1 새 텍스트의 링크 `[Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale)`, 변경 2 CHANGELOG 행의 같은 링크
+  - 위반 규약: 직접적인 규약 위반은 아니나, 이 plan 문서는 `plan/in-progress/` 에 위치하고 링크 대상은 `spec/2-navigation/4-integration.md` 이다. 상대 경로 `../../` 를 기준으로 하면 `plan/in-progress/` 에서 두 단계 상위인 루트로 올라가 `spec/2-navigation/4-integration.md` 가 맞으므로 경로 자체는 유효하다.
+  - 상세: 렌더러(GitHub, IDE)마다 worktree 최상위가 다를 수 있고, plan 파일이 `plan/complete/` 로 이동 후에도 동일 상대 경로가 유효해야 한다. `plan/complete/` 에서는 동일하게 두 단계 상위가 루트이므로 이동 후에도 경로는 유지된다. 실질적 위험은 낮다.
+  - 제안: 명시적으로 루트 기준 경로(`/spec/2-navigation/4-integration.md#rationale`)를 사용하거나, 현재 방식을 유지해도 무방하다. INFO 수준으로만 기록한다.
+
+---
+
+## 요약
+
+`plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 는 CLAUDE.md 의 정식 규약을 전반적으로 잘 준수하고 있다. frontmatter 의 필수 3키(`worktree`, `started`, `owner`)가 모두 존재하고, 옛 `prd/`·`memory/` 경로 사용, 금지된 외부 LLM 호출 패턴 등 명시적 금지 항목은 발견되지 않았다. spec 파일 수정 내용은 `spec/4-nodes/4-integration/4-cafe24.md` 와 `spec/2-navigation/4-integration.md` 를 대상으로 적절히 기술되어 있으며, 변경 3의 Rationale 섹션 추가 방식은 CLAUDE.md 의 권장 3섹션 구성(Overview/본문/Rationale)을 정확히 따른다. 발견된 세 건은 모두 INFO 수준으로, 규약 직접 위반이나 다른 시스템의 invariant 를 깨는 항목은 없다. 다만 `spec_files` 키가 공식 frontmatter 스키마에 포함되지 않은 점은 plan 관련 규약 문서에 보완을 권장한다.
+
+---
+
+## 위험도
+
+LOW

```

---

### 파일 24: review/consistency/2026/05/16/14_06_49/cross_spec/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_06_49/cross_spec/review.md b/review/consistency/2026/05/16/14_06_49/cross_spec/review.md
new file mode 100644
index 00000000..7cb2b837
--- /dev/null
+++ b/review/consistency/2026/05/16/14_06_49/cross_spec/review.md
@@ -0,0 +1,85 @@
+# Cross-Spec 일관성 검토 — Cafe24 HMAC raw-value 보존 재정정
+
+Target: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md`
+검토 시각: 2026-05-16
+
+---
+
+## 발견사항
+
+### 1. [CRITICAL] CHANGELOG 삽입 앵커 불일치 — `2026-05-16 (ux-cleanup)` 행 부재
+
+- **target 위치**: 변경 2 "CHANGELOG 행 추가", "기존 `2026-05-16 (ux-cleanup)` 행 다음에 추가"
+- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md §10 CHANGELOG`
+- **상세**: target 문서는 새 CHANGELOG 행을 "기존 `2026-05-16 (ux-cleanup)` 행 다음" 에 삽입하도록 지시하나, 현재 `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG 에는 해당 태그를 가진 행이 존재하지 않는다. 현재 마지막 행은 `2026-05-16 (catalog)` 이다. 개발자가 draft 를 그대로 따르면 삽입 위치를 결정할 수 없다.
+- **제안**: draft 의 앵커를 실제 마지막 행인 `2026-05-16 (catalog)` 으로 수정하거나, 새 행을 "CHANGELOG 표 마지막 행으로 추가" 로 재기술한다.
+
+---
+
+### 2. [CRITICAL] spec §9.8 알고리즘과 현행 백엔드 구현의 직접 모순
+
+- **target 위치**: 변경 1 — §9.8 알고리즘 단계 2 및 새 코드 예시 (`buildHmacMessage`)
+- **충돌 대상**: `backend/src/modules/integrations/integration-oauth.service.ts` L1564–1635 (현재 배포된 코드)
+- **상세**: target 문서는 §9.8 알고리즘을 "raw URL-encoded 값 그대로 보존, decode/re-encode 금지" 로 바꾸는 spec 정정이다. 그러나 현재 backend 코드는 여전히 `URLSearchParams` 로 decode → `formUrlEncode` 로 재인코딩하는 PR #67 SEC H-1 방식을 구현하고 있다. spec 이 갱신되면 spec 과 구현 사이에 직접 모순이 생긴다. spec 채택 후 developer 가 구현을 동기화하지 않으면 운영 HMAC 검증이 spec 과 다른 알고리즘으로 계속 실행된다.
+  - 현행 코드: `URLSearchParams(rawQuery)` → `formUrlEncode(v)` (공백 `%20` → `+`)
+  - 신규 spec: `rawQuery.split('&')` → raw value 그대로 (decode 없음)
+  - 이 두 알고리즘은 공백이 포함된 파라미터(`user_name=%20...` vs `user_name=+...`)에서 서로 다른 메시지를 생성한다.
+- **제안**: spec 갱신과 동시에 `backend/src/modules/integrations/integration-oauth.service.ts` 의 `buildHmacMessage` 함수를 raw-value 방식으로 교체해야 한다. developer plan 에 구현 동기화 태스크를 명시적으로 포함시킨다. spec 단독 갱신은 spec-코드 불일치를 유발하므로, spec 병합과 구현 PR 을 동일 브랜치로 묶거나 순서를 명시한다.
+
+---
+
+### 3. [CRITICAL] 기존 HMAC 테스트가 spec 과 self-fulfilling 모순 — 회귀 보호 부재
+
+- **target 위치**: 변경 3 Rationale "테스트 보강" 단락
+- **충돌 대상**: `backend/src/modules/integrations/integration-oauth.service.cafe24.spec.ts` L708 `'accepts HMAC for queries containing space-encoded values (URLEncoder compat)'`
+- **상세**: target 문서는 "옛 `accepts HMAC for queries containing space-encoded values` 테스트는 `John+Doe` 형식을 사용했으나 self-fulfilling 검증(compute 와 verify 가 같은 broken 알고리즘 사용)"이라고 명시한다. 현재 테스트 파일의 `formUrlEncodeForTest` 헬퍼(L25)가 production `formUrlEncode` 와 동일한 broken 알고리즘을 복제하고 있어 실제 Cafe24 동작을 검증하지 못한다. spec 이 raw-value 방식으로 바뀌면 이 테스트는 새 spec 에서 실패한다(또는 동일 self-fulfilling 패턴이 유지되면 여전히 오검증). 새 spec 의 알고리즘이 구현되어도 `John+Doe` 기반 테스트가 남아 있으면 회귀 보호가 없는 것과 같다.
+- **제안**: spec 적용과 동시에 테스트 파일의 `formUrlEncodeForTest` 헬퍼와 기존 `John+Doe` 기반 HMAC 테스트를 제거하고, draft 가 제안하는 `user_name=...%20...` raw URL 형식 테스트로 교체한다. 이를 개발 plan 의 필수 항목으로 포함시킨다.
+
+---
+
+### 4. [WARNING] 변경 3 Rationale 삽입 앵커 불일치 — "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" 부재
+
+- **target 위치**: 변경 3 "위치: `## Rationale` 섹션 말미, 현재 마지막 항 'Cafe24 App URL 상세 페이지 표시 (2026-05-16)' 다음에 추가"
+- **충돌 대상**: `spec/2-navigation/4-integration.md ## Rationale` 현행 마지막 항 "install_timeout 알림 미발사 (2026-05-16)"
+- **상세**: draft 가 지정한 삽입 앵커 항목 "Cafe24 App URL 상세 페이지 표시 (2026-05-16)" 는 현재 `spec/2-navigation/4-integration.md` 의 Rationale 섹션에 존재하지 않는다. 현재 실제 마지막 Rationale 항은 "install_timeout 알림 미발사 (2026-05-16)" 이다. 삽입 위치 오기술이지만 "섹션 말미"라는 의도가 명확하므로 CRITICAL 이 아닌 WARNING 으로 등급화한다.
+- **제안**: draft 의 삽입 위치 설명을 "## Rationale 섹션 말미, 현재 마지막 항 'install_timeout 알림 미발사 (2026-05-16)' 다음" 으로 수정한다.
+
+---
+
+### 5. [WARNING] `verifyHmac` 함수 시그니처 — spec 코드 예시와 실제 구현 분리 패턴 불일치
+
+- **target 위치**: 변경 1 "새 코드 예시" — `verifyHmac(rawQuery, clientSecret, receivedHmac)` 단일 함수
+- **충돌 대상**: `backend/src/modules/integrations/integration-oauth.service.ts` L1574–1635 — `buildHmacMessage` + `verifyHmacWithMessage` 분리 패턴
+- **상세**: target draft 의 새 코드 예시는 `buildHmacMessage` + `verifyHmac` (단일 함수) 두 개를 보여준다. 그러나 현재 backend 코드는 `buildHmacMessage` + `verifyHmacWithMessage` 로 분리되어 있으며, `tryRecoverByMallId` 가 `buildHmacMessage` 를 한 번 호출하고 후보별로 `verifyHmacWithMessage` 를 재사용하는 패턴이다. draft 의 `verifyHmac` 단일 함수 예시는 `rawQuery` 를 인자로 받아 내부에서 `buildHmacMessage` 를 호출하므로, 현재 구현의 분리 패턴과 다르다. spec 예시가 그대로 적용되면 `tryRecoverByMallId` 에서 후보마다 `rawQuery` 재파싱이 발생한다.
+  - 이미 draft 의 self-check 에서 "호출자 변경 불필요" 라고 기재되어 있으나, spec 코드 예시가 구현 패턴과 불일치하면 이후 개발자가 혼동할 수 있다.
+- **제안**: spec 의 코드 예시를 현행 구현 패턴(`buildHmacMessage` + `verifyHmacWithMessage` 분리) 에 맞게 조정하거나, 예시는 개념 설명용이고 실제 분리 패턴은 주석으로 명시한다.
+
+---
+
+### 6. [WARNING] `data-flow/5-integration.md` 의 callback 후 `install_token=NULL` 처리 기술 — 기존 spec 과 모순 (pre-existing)
+
+- **target 위치**: target draft 본체와 직접 관련 없음 (검토 과정에서 발견된 기존 drift)
+- **충돌 대상**: `spec/data-flow/5-integration.md` L90 (`UPDATE integration SET status=connected, install_token=NULL, ...`) vs `spec/4-nodes/4-integration/4-cafe24.md §9.8` ("install_token 은 통합 lifetime 동안 보존")
+- **상세**: `data-flow/5-integration.md` 는 callback 성공 시 `install_token=NULL` 로 표기하고 있으나, `spec/4-nodes/4-integration/4-cafe24.md §9.8` 및 `spec/2-navigation/4-integration.md §6 상태 전이` 에 따르면 2026-05-15 이후 install_token 은 post-install navigation 의 persistent 식별자로 격상되어 callback 성공 시에도 NULL 처리하지 않는다. 이는 target draft 가 도입한 것이 아닌 기존 spec drift 이지만, 이번 변경과 같은 맥락(§9.8 갱신)이므로 함께 수정할 기회다.
+- **제안**: `spec/data-flow/5-integration.md` L90 을 `UPDATE integration SET status=connected, credentials ENC, token_expires_at, last_rotated_at` (install_token 제거)로 수정하고, 관련 다이어그램 주석에 "install_token 은 통합 lifetime 동안 보존 — [§9.8]" 을 추가한다.
+
+---
+
+### 7. [INFO] `spec/4-nodes/4-integration/4-cafe24.md §10 CHANGELOG` — 최신 항이 `(catalog)` 로 끝나 hmac-raw-fix 맥락 연결이 모호
+
+- **target 위치**: 변경 2 CHANGELOG 행 (삽입 위치 수정 후)
+- **충돌 대상**: `spec/4-nodes/4-integration/4-cafe24.md §10 CHANGELOG` 기존 마지막 행 `2026-05-16 (catalog)`
+- **상세**: 새 CHANGELOG 행 태그가 `(hmac-raw-fix)` 인 반면, 바로 앞 행이 `(catalog)` 여서 `(후속)`, `(ux-cleanup)` 같은 누락 태그가 있다는 인상을 줄 수 있다. consistency 문제는 아니지만 CHANGELOG 의 시계열 가독성을 위해 명시적 주석이 있으면 좋다.
+- **제안**: CHANGELOG 행에 "PR #67 SEC H-1 후속 재정정" 맥락을 짧게 명시하거나, 태그를 `(hmac-raw-fix, SEC H-1 재정정)` 으로 보강한다.
+
+---
+
+## 요약
+
+Target 문서 자체의 논리는 정합적이나, spec 정정 범위와 실제 구현·테스트 동기화가 단일 plan 에 묶여 있지 않아 spec 만 갱신되고 코드가 구 알고리즘으로 남을 위험이 CRITICAL 급이다. 특히 (1) CHANGELOG 삽입 앵커 오기, (2) 백엔드 `buildHmacMessage` / `formUrlEncode` 가 여전히 PR #67 방식으로 배포되어 있어 spec 채택 후 spec-구현 직접 모순, (3) `formUrlEncodeForTest` 를 사용하는 self-fulfilling 테스트가 제거되지 않으면 신규 spec 의 회귀 보호가 없는 세 가지 CRITICAL 이 있다. WARNING 급으로는 변경 3 삽입 앵커 오기, spec 코드 예시와 실제 분리 패턴 불일치, data-flow/5-integration.md 의 install_token=NULL 오기(기존 drift) 가 식별된다. spec 적용 plan 에 구현·테스트 동기화 태스크를 명시적으로 포함해야 spec 정정이 운영에서 효과를 발휘한다.
+
+---
+
+## 위험도
+
+**HIGH** — spec 단독 적용 시 spec 과 운영 코드가 서로 다른 HMAC 알고리즘을 정의하는 직접 모순 상태가 된다. 구현 동기화가 함께 이뤄지면 spec 자체의 논리적 모순은 없으며 MEDIUM 으로 하락한다.

```

---

### 파일 25: review/consistency/2026/05/16/14_06_49/meta.json
- 변경 유형: Review
- 언어: json

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_06_49/meta.json b/review/consistency/2026/05/16/14_06_49/meta.json
new file mode 100644
index 00000000..244b952e
--- /dev/null
+++ b/review/consistency/2026/05/16/14_06_49/meta.json
@@ -0,0 +1,12 @@
+{
+  "timestamp": "2026-05-16T14:06:49.131489",
+  "mode": "spec draft 검토 (--spec)",
+  "target_path": "plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md",
+  "checkers": [
+    "cross_spec",
+    "rationale_continuity",
+    "convention_compliance",
+    "plan_coherence",
+    "naming_collision"
+  ]
+}
\ No newline at end of file

```

---

### 파일 26: review/consistency/2026/05/16/14_06_49/naming_collision/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_06_49/naming_collision/review.md b/review/consistency/2026/05/16/14_06_49/naming_collision/review.md
new file mode 100644
index 00000000..1f0d1e2d
--- /dev/null
+++ b/review/consistency/2026/05/16/14_06_49/naming_collision/review.md
@@ -0,0 +1,51 @@
+# 신규 식별자 충돌 검토 — Cafe24 HMAC 알고리즘 재정정
+
+**검토 대상**: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md`
+**검토 일시**: 2026-05-16
+**검토 모드**: spec draft 검토 (--spec)
+
+---
+
+### 발견사항
+
+- **[INFO]** `buildHmacMessage` 함수명 — 기존 spec 내 동일 이름이 동일 의미로 사용됨 (교체 정정)
+  - target 신규 식별자: `buildHmacMessage(rawQuery: string): string`
+  - 기존 사용처: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 (PR #67 SEC H-1 에서 도입된 기존 `buildHmacMessage`). 동일 파일 동일 섹션에 이미 존재.
+  - 상세: target 이 기존 `buildHmacMessage` 의 시그니처와 이름을 **그대로 유지**하면서 내부 로직(URLSearchParams decode 제거, rawQuery 직접 split)만 변경한다. 이름·파라미터 타입·반환 타입이 동일하므로 식별자 충돌이 아니라 교체(정정)다. 호출자(`handleInstall`, `tryRecoverByMallId`)의 코드 변경이 불필요하다고 self-check에서 명시하고 있어 시그니처 호환성이 보장된다.
+  - 제안: 충돌 없음. 단, spec 코드 예시에서 기존 구현을 정확히 삭제하고 신규 구현으로 대체함을 문서화하면 혼선 예방에 도움된다 (변경 1에서 이미 명시함).
+
+- **[INFO]** `verifyHmac` 함수명 — spec 본문에 신규 보조 함수로 추가됨
+  - target 신규 식별자: `verifyHmac(rawQuery: string, clientSecret: string, receivedHmac: string): boolean`
+  - 기존 사용처: 코퍼스 전체에서 `verifyHmac` 이름을 다른 의미로 사용하는 사례 없음. `spec/4-nodes/4-integration/4-cafe24.md` 기존 §9.8 에는 `buildHmacMessage` 는 있으나 `verifyHmac` 독립 함수는 없었음(검증 로직이 인라인 처리).
+  - 상세: 신규 이름이며 기존 사용처와 충돌 없음. `verifyHmac` 는 암호학적 검증 책임을 명시적으로 분리한 헬퍼로, 다른 영역의 `verifyHmac`-유사 이름(예: auth 도메인의 token verify 등)과 혼동 가능성 검토 필요. spec/5-system/1-auth.md 등 인증 도메인에서는 `verifyHmac` 명칭이 사용되지 않아 충돌 없음.
+  - 제안: 충돌 없음. 필요하다면 `verifyCafe24Hmac` 으로 더 범위를 좁힌 이름도 고려할 수 있으나, spec 코드 예시 수준에서는 현행 이름으로 충분하다.
+
+- **[INFO]** Rationale 섹션 앵커 — 기존 Rationale 항목과 이름 유사성 없음
+  - target 신규 식별자: `### HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)` (spec/2-navigation/4-integration.md Rationale 말미 추가)
+  - 기존 사용처: `spec/2-navigation/4-integration.md` 의 기존 Rationale 항목 중 관련 이름으로는 `Cafe24 App URL 상세 페이지 표시 (2026-05-16)`, `install_token TTL 24h`, `CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제`, `Cafe24 App URL 100자 한도 대응` 등이 있음. 명칭 중복 없음.
+  - 상세: 신규 Rationale 항 제목이 기존 항목과 겹치지 않으며 날짜 태그 `(2026-05-16 재정정)` 로 충분히 구분됨. 앵커 충돌 없음.
+  - 제안: 충돌 없음.
+
+- **[INFO]** CHANGELOG 태그 `2026-05-16 (hmac-raw-fix)` — 기존 CHANGELOG 항목과 구분됨
+  - target 신규 식별자: CHANGELOG 행의 날짜+태그 `2026-05-16 (hmac-raw-fix)`
+  - 기존 사용처: `spec/4-nodes/4-integration/4-cafe24.md` §10 CHANGELOG 에 이미 `2026-05-16 (ux-cleanup)` 행이 존재한다고 target 본문이 언급함. 두 항목은 같은 날짜이나 태그가 다름 (`ux-cleanup` vs `hmac-raw-fix`).
+  - 상세: CHANGELOG 는 날짜+태그의 조합으로 고유성을 가지므로 동일 날짜 다른 태그는 허용된 패턴이다. 충돌 없음.
+  - 제안: 충돌 없음.
+
+- **[INFO]** 제거 대상 `formUrlEncode` — spec 본문 외 인용 없음 확인
+  - target 신규 식별자: 해당 없음 (제거 작업)
+  - 기존 사용처: target self-check 에서 "`formUrlEncode` 헬퍼는 spec 본문 외 다른 인용 없음 (grep 확인)"으로 명시. 제공된 코퍼스(`spec/0-overview.md`, `spec/1-data-model.md`, `spec/2-navigation/0-dashboard.md`, `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/11-error-empty-states.md`) 에서 `formUrlEncode` 참조 없음.
+  - 상세: 제거 후 dangling reference 위험 없음. 단, 코퍼스에 `spec/4-nodes/4-integration/4-cafe24.md` 원문이 포함되어 있지 않아 해당 파일 내부의 다른 섹션에서 `formUrlEncode` 를 참조하는지 직접 확인 불가. self-check 의 grep 결과를 신뢰한다.
+  - 제안: 구현 단계에서 `backend/` 코드의 `formUrlEncode` 호출부를 별도 grep 으로 재확인할 것을 권장한다.
+
+---
+
+### 요약
+
+target 문서(`spec-draft-cafe24-hmac-raw-fix.md`)가 도입하는 신규 식별자는 `buildHmacMessage`, `verifyHmac`, `rawQuery` 파라미터, Rationale 섹션명, CHANGELOG 태그 `hmac-raw-fix` 이며, 이 중 어느 것도 기존 사용처에서 다른 의미로 사용 중인 사례가 발견되지 않았다. `buildHmacMessage` 는 기존 spec 에 동일 이름이 존재하지만 시그니처를 유지한 채 로직만 교체하는 정정(정합성 있는 교체)이므로 식별자 충돌에 해당하지 않는다. `verifyHmac` 는 순수 신규 이름으로 전체 코퍼스 내 다른 도메인에서 동일 이름의 이종 함수가 없다. 파일 경로는 기존 파일 수정이며 신규 파일 생성이 없어 파일 경로 충돌도 없다. 전체적으로 신규 식별자 충돌 관점에서 차단 사유가 없고 INFO 수준의 보완 제안만 존재한다.
+
+---
+
+### 위험도
+
+NONE

```

---

### 파일 27: review/consistency/2026/05/16/14_06_49/plan_coherence/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_06_49/plan_coherence/review.md b/review/consistency/2026/05/16/14_06_49/plan_coherence/review.md
new file mode 100644
index 00000000..4b1f6278
--- /dev/null
+++ b/review/consistency/2026/05/16/14_06_49/plan_coherence/review.md
@@ -0,0 +1,27 @@
+### 발견사항
+
+- **[INFO]** `spec-update-cafe24-app-url-reuse.md` 의 미완료 spec 갱신 항목과 target 이 같은 spec 파일 수정
+  - target 위치: target plan 전체 (`변경 1`, `변경 2`) — `spec/4-nodes/4-integration/4-cafe24.md` §9.8 및 CHANGELOG
+  - 관련 plan: `plan/in-progress/spec-update-cafe24-app-url-reuse.md` — "영향 받는 spec 섹션" 항목 중 `spec/4-nodes/4-integration/4-cafe24.md` §9.4 의 install_token 소거 표기 갱신 (`- [ ] spec 갱신`) 이 미체크 상태
+  - 상세: `spec-update-cafe24-app-url-reuse.md` 의 worktree(`cafe24-app-url-reuse-f9a2e3`)는 현재 실제로 존재하지 않는다(`.claude/worktrees/` 확인 결과 없음). 해당 plan 의 spec 갱신 체크박스 `[ ] spec 갱신` 는 미완료 상태이며 `spec/4-nodes/4-integration/4-cafe24.md` §9.4 를 대상으로 한다. target plan 은 같은 파일의 §9.8 을 수정하므로 섹션이 달라 직접 충돌은 없으나, 해당 plan 의 미완 spec 갱신이 target과 같은 CHANGELOG(`§10`) 에도 연관될 수 있다. worktree 가 소멸한 plan 의 미완 spec 갱신이 처리되기 전에 target이 같은 파일을 수정하는 것이므로 순서 문제로 기록.
+  - 제안: `spec-update-cafe24-app-url-reuse.md` 의 미완 `[ ] spec 갱신` 항목이 CHANGELOG 행에도 영향을 주는지 확인. 영향 없다면 INFO로 종결, 영향 있다면 해당 plan을 먼저 완료 후 target을 진행하도록 plan 에 선후관계를 명시.
+
+- **[INFO]** `spec-update-cafe24-background-refresh.md` 의 미완료 spec 갱신이 target 파일과 동일 파일 대상
+  - target 위치: target plan `변경 2` — `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG 행 추가
+  - 관련 plan: `plan/in-progress/spec-update-cafe24-background-refresh.md` — `spec/2-navigation/4-integration.md` §11 수정을 위한 미완 항목 3개 (`[ ] project-planner 진입해 위 4개 항목 작성`, `[ ] /consistency-check --spec 통과 확인`, `[ ] PR merge 시 plan/complete 이동`). 이 plan 의 worktree(`prod-rereview-fix-a7c93f`) 는 현재 존재하지 않음.
+  - 상세: `spec-update-cafe24-background-refresh.md` 는 `spec/2-navigation/4-integration.md` 만 수정 대상이고 `spec/4-nodes/4-integration/4-cafe24.md` 는 수정 대상이 아니다. target 이 수정하는 `spec/2-navigation/4-integration.md` (변경 3 — Rationale 신규 항 추가) 와 이 plan이 수정하는 `spec/2-navigation/4-integration.md` §11 은 서로 다른 섹션이라 직접 충돌은 없다. 다만 두 plan 이 동일 파일을 (서로 다른 섹션에서) 동시에 수정 예정이라는 점을 추적용으로 기록.
+  - 제안: target 진행 시 `spec/2-navigation/4-integration.md` Rationale 추가 완료 후, `spec-update-cafe24-background-refresh.md` 담당자가 §11 추가 시 동일 파일의 변경 이력이 두 개 PR 로 나뉘어 있음을 인지하도록 해당 plan 에 메모 추가 권장.
+
+- **[INFO]** target plan 의 "테스트 보강" 언급이 별도 개발 plan 에서 처리돼야 하는데 후속 plan 이 없음
+  - target 위치: target plan `변경 3` — Rationale 내 "테스트 보강" 문단 ("사용자 실제 URL (`user_name=...%20...` + 실제 timestamp + 실제 hmac) 의 회귀 보호 테스트 추가")
+  - 관련 plan: 없음 (현존 plan 중 이 회귀 테스트를 명시적으로 추적하는 항목 없음)
+  - 상세: target 이 spec-only draft 이므로 구현 테스트 보강은 후속 `developer` plan 에서 처리해야 하나, 아직 해당 plan 이 존재하지 않는다. spec draft 특성상 구현 plan 이 나중에 만들어지는 것이 자연스럽지만, Rationale 에 테스트 기대사항이 구체적으로 기술되어 있어 구현 착수 시점에 별도 plan 이 필요하다는 점을 추적할 필요가 있다.
+  - 제안: target plan 에 "후속 작업 — 구현 plan 필요" 항목으로 "회귀 보호 테스트 (`user_name=%20` 형식 케이스) 추가" 를 명시하거나, 구현 plan 생성 시 이 항목을 반드시 포함하도록 메모.
+
+### 요약
+
+target plan(`spec-draft-cafe24-hmac-raw-fix.md`)은 `spec/4-nodes/4-integration/4-cafe24.md` §9.8 알고리즘 정정과 `spec/2-navigation/4-integration.md` Rationale 추가를 다룬다. 현재 진행 중인 다른 plan 들 중 `spec-update-cafe24-app-url-reuse.md`(worktree 소멸, spec 갱신 미완)와 `spec-update-cafe24-background-refresh.md`(worktree 소멸, 미완료)가 동일 파일을 대상으로 하나, 수정 섹션이 다르고(§9.4 vs §9.8 / §11 vs Rationale) worktree 도 현재 존재하지 않아 병렬 경합 위험은 낮다. `cafe24-node-resource-operation-ux.md`(worktree `cafe24-node-ux-catalog-4b8f2c` 활성)는 `spec/4-nodes/4-integration/4-cafe24.md` §2·§9.3 을 다루며 §9.8 HMAC 영역에는 접근하지 않는다. 미해결 결정을 우회하는 항목이나 CRITICAL 수준의 직접 worktree 충돌은 발견되지 않았다. 발견 사항은 INFO 3건으로, 전체 plan 정합성에 미치는 위험도는 낮다.
+
+### 위험도
+
+LOW

```

---

### 파일 28: review/consistency/2026/05/16/14_06_49/rationale_continuity/review.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/review/consistency/2026/05/16/14_06_49/rationale_continuity/review.md b/review/consistency/2026/05/16/14_06_49/rationale_continuity/review.md
new file mode 100644
index 00000000..96745912
--- /dev/null
+++ b/review/consistency/2026/05/16/14_06_49/rationale_continuity/review.md
@@ -0,0 +1,40 @@
+# Rationale 연속성 검토 — Cafe24 HMAC 알고리즘 재정정
+
+검토 대상: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md`
+검토 모드: spec draft (--spec)
+검토 일시: 2026-05-16
+
+---
+
+### 발견사항
+
+- **[INFO]** PR #67 SEC H-1 번복 — 새 Rationale 동반 여부 확인
+  - target 위치: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 변경 1 (§9.8 알고리즘 본문 정정) + 변경 3 (Rationale 신규 항)
+  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md` §9.8 코드 블록 주석 (line 435-438) 및 `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG (line 497) "PR #67 SEC H-1"
+  - 상세: 현행 §9.8 spec 은 PR #67 SEC H-1 이 결정한 "`formUrlEncode` (Java URLEncoder 호환, 공백 `+`)" 알고리즘이 기재되어 있다. target 은 이를 "raw URL-encoded 값 보존 (decode/re-encode 금지)" 으로 번복한다. 그러나 target 은 이 번복을 단독으로 수행하지 않고 변경 3 에서 `spec/2-navigation/4-integration.md ## Rationale` 에 신규 항 "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 을 명시적으로 추가하며, 번복 근거(공식 Java 샘플 `validationCheckHmac` 의 `request.getQueryString()` split → TreeMap raw 저장), 운영 재현 증거(사용자 URL `user_name=%EB...%20...`), 기각된 대안(다양한 인코더 시도), 이론적 추론, 테스트 보강 계획, 관련 history(2026-05-14 최초 → 2026-05-16 SEC H-1 잘못된 번복 → 2026-05-16 본 재정정)를 모두 기술하고 있다.
+  - 평가: 결정 번복에 새 Rationale 이 동반되어 있어 "무근거 번복" 에 해당하지 않는다. INFO 수준으로 분류.
+  - 제안: target 의 변경 1 §9.8 본문 정정과 변경 3 Rationale 추가가 하나의 atomic 변경으로 스펙에 반영되어야 한다. 변경 2 CHANGELOG 행이 이를 연결하고 있으므로 세 변경이 함께 커밋되면 정합성이 유지된다.
+
+- **[INFO]** 기각된 인코더 목록과 2026-05-14 최초 알고리즘(`encodeURIComponent`) 의 위치
+  - target 위치: 변경 3 Rationale 항 "기각된 옵션" 단락
+  - 과거 결정 출처: `spec/4-nodes/4-integration/4-cafe24.md` CHANGELOG 2026-05-14 항 ("§9.8 HMAC 검증 알고리즘 추가") 및 CHANGELOG 2026-05-16 항 ("PR #67 SEC H-1" 에서 `formUrlEncode` 로 정정)
+  - 상세: target 의 "관련 history" 단락이 "2026-05-14: `encodeURIComponent` 사용, 운영 양호" 로 기술하지만, 현행 spec 의 CHANGELOG에는 2026-05-14의 최초 알고리즘 내용이 상세히 기재되어 있지 않다(§9.8 추가 사실만 명시). `encodeURIComponent` 가 "운영 양호"였다는 사실 및 SEC H-1 이 이를 깨뜨렸다는 인과 관계가 spec Rationale 본문에는 아직 존재하지 않는다. target 의 Rationale 신규 항이 이를 처음으로 명시화한다.
+  - 평가: target 이 새 Rationale 에서 이 history 를 완전하게 서술하므로 정합성 결손은 apply 후 해소된다. 적용 전 현재 상태의 history gap 을 인지하는 차원의 INFO.
+  - 제안: 별도 조치 불필요. 변경 3 이 적용되면 history 가 완결된다.
+
+- **[INFO]** `tryRecoverByMallId` 와 "raw 값 보존" 알고리즘의 상호작용 명시 여부
+  - target 위치: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 정합성 self-check 항
+  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" (line 1107-1120)
+  - 상세: `tryRecoverByMallId` 회복 흐름은 HMAC trial 검증을 수행한다. HMAC 알고리즘이 바뀌면 이 회복 분기의 HMAC 검증도 동일한 새 알고리즘을 사용해야 한다. target 의 self-check 항은 "`buildHmacMessage` 시그니처 호환 — 호출자 (`handleInstall`, `tryRecoverByMallId`) 변경 불필요" 를 명시하여 두 경로가 같은 함수를 공유함을 확인했다. 따라서 알고리즘 변경이 `tryRecoverByMallId` 에도 자동으로 적용되는 구조이나, 이 연계를 spec Rationale 에 명시하면 향후 유지보수 혼동을 줄일 수 있다.
+  - 평가: 구조적 정합성은 확보되어 있으며 위반이 아니다. 문서 명확성 보완 차원의 INFO.
+  - 제안: 변경 3 의 Rationale 신규 항 또는 "Cafe24 install_token mismatch 회복 흐름 — 보안 전제" 항에 "HMAC 알고리즘 재정정(raw 보존) 이 회복 분기에도 동일하게 적용됨 — `buildHmacMessage` 함수 공유 구조" 한 줄을 추가하면 완결된다.
+
+---
+
+### 요약
+
+target 문서(`spec-draft-cafe24-hmac-raw-fix.md`)는 PR #67 SEC H-1 의 "`formUrlEncode` (Java URLEncoder 호환)" 결정을 "raw URL-encoded 값 보존" 으로 번복하는 내용을 담고 있다. 이 번복은 합의 원칙을 무시하거나 기각된 대안을 이유 없이 재도입하는 것이 아니라, 운영 재현 증거와 Cafe24 공식 Java 샘플 분석에 기반한 명시적 재정정이며, 변경 3 에서 신규 Rationale 항을 동시에 작성하고 있다. 기각된 옵션(다양한 인코더 시도) 도 Rationale 내에서 명시적으로 폐기 이유와 함께 기록되어 있다. Rationale 에 기록된 기존 invariant(단일 row 조회 + HMAC 1회 검증, capability-token 보안 전제, `tryRecoverByMallId` HMAC 검증 유지, `SECRET_LEAK_PATTERNS` 정책)는 모두 침해하지 않는다. 전반적으로 Rationale 연속성 관점에서 위반 사항이 없으며, 세 가지 INFO는 문서 완결성을 높이는 보완 제안이다.
+
+### 위험도
+
+NONE

```

---

### 파일 29: spec/1-data-model.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/1-data-model.md b/spec/1-data-model.md
index 8c2dc35a..71256d8c 100644
--- a/spec/1-data-model.md
+++ b/spec/1-data-model.md
@@ -250,8 +250,8 @@ Schedule은 Trigger의 서브타입이다. 양쪽의 라이프사이클과 상
 | credentials | JSONB (encrypted) | 인증 정보 (암호화 저장). OAuth의 경우 `scopes: string[]` 포함 |
 | scope | Enum | personal / organization |
 | status | Enum | connected / expired / error / pending_install |
-| install_token | String? | Cafe24 Private 앱 설치 흐름 식별 키. `oauth/begin (app_type=private)` 시 **16바이트를 `base64url` (no padding, 22자) 인코딩**해 발급, callback 성공 또는 TTL 만료 시 NULL. Cafe24 private 전용 — 다른 service_type 에서는 항상 NULL. **형식 변경 (2026-05-15)**: 옛 32바이트 hex (64자) 는 Cafe24 App URL 100자 한도 초과로 폐기 — 본 문서 Rationale 의 "install_token 형식" 항 참조. 정식 라이프사이클은 [Spec 통합 화면 §6 상태 전이](./2-navigation/4-integration.md#6-상태-전이) 와 [§9.2 API](./2-navigation/4-integration.md#92-인증--회전--scope) |
-| install_token_issued_at | Timestamp? | Cafe24 Private `install_token` 발급 시각. TTL 스캐너 (`pending-install-ttl` job) 가 `now - 24h` 와 비교해 만료 판단 — 초과 시 `status='expired', status_reason='install_timeout', install_token=NULL` 로 전이. 재사용/새 발급 시 갱신, callback 성공 시 NULL. 옛 (V044 이전) 행은 NULL → 스캐너가 `created_at` 으로 fallback 하여 동일 24h TTL 적용 (배포 직후 일괄 expired 처리 없음 — `created_at` 이 이미 24h 이상 지난 행만 자연스럽게 expired 됨). V044 추가 |
+| install_token | String? | Cafe24 Private 앱 설치 흐름 식별 키. `oauth/begin (app_type=private)` 시 **16바이트를 `base64url` (no padding, 22자) 인코딩**해 발급. 통합 lifetime 동안 **보존** (post-install navigation 의 식별 키) — callback 성공 시 보존, `pending_install → expired (install_timeout)` 24h TTL 만료 또는 통합 삭제 시에만 NULL/소거. Cafe24 private 전용 — 다른 service_type 에서는 항상 NULL. **형식 변경 (2026-05-15)**: 옛 32바이트 hex (64자) 는 Cafe24 App URL 100자 한도 초과로 폐기 — 본 문서 Rationale 의 "install_token 형식" 항 참조. 정식 라이프사이클은 [Spec 통합 화면 §6 상태 전이](./2-navigation/4-integration.md#6-상태-전이) 와 [§9.2 API](./2-navigation/4-integration.md#92-인증--회전--scope) 및 Rationale "install_token TTL 24h" |
+| install_token_issued_at | Timestamp? | Cafe24 Private `install_token` 발급 시각. TTL 스캐너 (`pending-install-ttl` job) 가 `now - 24h` 와 비교해 만료 판단 — 초과 시 `status='expired', status_reason='install_timeout', install_token=NULL` 로 전이. 재사용/새 발급 시 갱신, **callback 성공 시 보존** (`install_token` 과 동행 — `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 참조). TTL 만료 / 통합 삭제 경로에서만 NULL 처리. 옛 (V044 이전) 행은 NULL → 스캐너가 `created_at` 으로 fallback 하여 동일 24h TTL 적용 (배포 직후 일괄 expired 처리 없음 — `created_at` 이 이미 24h 이상 지난 행만 자연스럽게 expired 됨). V044 추가 |
 | mall_id | String? | Cafe24 `mall_id` 의 plain projection — `credentials.mall_id` 와 동일 값을 plain 컬럼으로 복제. `(workspace_id, mall_id)` 부분 UNIQUE 인덱스가 SQL 레벨에서 중복 cafe24 통합을 거부하고, decrypt 없이 O(1) lookup 가능. cafe24 외 service_type 에서는 항상 NULL. 옛 (V045 이전) 행은 NULL — 다음 ORM save (callback / reauth) 시 backfill. **비즈니스 규칙**: 같은 workspace 내 같은 `mall_id` 의 cafe24 통합은 `app_type` 무관 최대 1행 — 한 mall 에 public·private 을 동시에 보유하면 토큰·webhook 처리 주체가 분기되어 사용자 혼란과 회계 충돌을 유발하므로 spec 차원에서 금지. Public App 지원 시 재검토 대상. V045 추가 |
 | status_reason | String? | 상태별 사유 코드 (모두 `snake_case`). `error` → `insufficient_scope` / `auth_failed` / `network` / `unknown` (현행) — `credentials_unreadable` 은 기존 분기로 정합성 유지. **(2026-05-16 갱신)** `auth_failed` 는 401/403 외에 refresh `invalid_grant` 도 포함 (옛 `expired(refresh_failed)` 가 본 사유로 이행 — REQ HIGH-2). `network` 는 transport 3회 연속 실패 카운터 (`consecutive_network_failures` 컬럼) 가 3 도달 시 전이. `expired` → `token_expired` (refresh_token 없는 provider 의 token_expires_at 만료) / `install_timeout` (Cafe24 Private 24h TTL). **`refresh_failed` 는 제거 — `error(auth_failed)` 로 이행 (REQ HIGH-2).** `pending_install` → callback 실패 분기 코드 (`oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`). `resource_not_found` 는 row 가 사라진 케이스라 DB 갱신 불가 → 후보값 제외 ([Spec 통합 화면 §10.4](./2-navigation/4-integration.md#104-에러-매핑)). `connected` → NULL. ※ DB 저장값은 `snake_case`, 동일 의미의 API 에러 코드는 `OAUTH_*` `UPPER_SNAKE_CASE` (의도적 분리) |
 | consecutive_network_failures | int | 노드 실행 / 토큰 갱신 중 transport 실패 카운터. 성공 시 0 으로 리셋, 3 도달 시 `status='error', status_reason='network'` 로 전이 + 카운터 0 리셋. spec §6 `connected → error(network)` 전이의 구현 기반. V049 추가 (PR #67 REQ-C2). NOT NULL DEFAULT 0 — 기존 행은 0 으로 backfill |

```

---

### 파일 30: spec/2-navigation/4-integration.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/2-navigation/4-integration.md b/spec/2-navigation/4-integration.md
index 3feb804b..44fcc1da 100644
--- a/spec/2-navigation/4-integration.md
+++ b/spec/2-navigation/4-integration.md
@@ -248,6 +248,7 @@ Step 2 auth     ──submit──▶ Step 3 test
 | Quick actions | `Test connection` (connected 한정), `Reauthorize`(OAuth · `pending_install` 또는 cafe24 private 에서 비활성 — §4.3 Reauthorize 상세 조건 참조), `Rotate credentials`(비OAuth), `Edit alias` |
 | 상태 배지 | 현재 상태 + reason (`error(insufficient_scope)` 등) |
 | 별칭 편집 | 인라인 편집, `PATCH /api/integrations/:id` |
+| App URL 카드 (Cafe24 Private 한정) | `service_type='cafe24' AND credentials.app_type='private'` 일 때만 표시. **App URL** (`${APP_URL}/api/3rd-party/cafe24/install/:installToken`) 과 **Redirect URI** (`${APP_URL}/api/3rd-party/cafe24/callback`) 를 복사 버튼과 함께 노출한다. Cafe24 Developers Console 의 "앱 URL" 갱신용 — App URL HMAC 검증 실패 에러 페이지가 안내하는 비교 대상이 본 카드다. 신규 등록 흐름의 `Cafe24PrivatePending` 컴포넌트와 동일한 복사 UX 패턴 (라벨 + 모노스페이스 URL + 복사 버튼 + 1줄 안내) 재사용. 결정 근거는 Rationale "Cafe24 App URL 상세 페이지 표시" 항. |
 
 ### 4.3 Security 탭
 
@@ -671,7 +672,7 @@ Please replace or remove these node references first.
 |--------|------|------|
 | GET | `/api/integrations` | 목록 조회. 쿼리: `q`, `scope`, `serviceType`, `status`, `page`, `limit`. 페이지네이션 응답 형식은 [API 규약 §5.2](../5-system/2-api-convention.md#52-목록-응답) 준수 |
 | POST | `/api/integrations` | 연동 생성. OAuth는 `preview_token`으로 서버 임시 저장 토큰 참조 |
-| GET | `/api/integrations/:id` | 상세 조회 (credentials는 마스킹) |
+| GET | `/api/integrations/:id` | 상세 조회. credentials 는 마스킹. 응답 envelope 는 [API 규약 §5.1](../5-system/2-api-convention.md#51-단일-리소스) 의 `{ data: IntegrationDto }` 형식이며, `IntegrationDto` 는 `appUrl: string \| null` 필드를 포함한다 — Cafe24 Private 통합 (`service_type='cafe24' AND credentials.app_type='private'`) 은 `${APP_URL}/api/3rd-party/cafe24/install/:installToken` 값, 그 외 통합은 `null`. `install_token` 자체는 응답에 별도 필드로 노출되지 않고 App URL path segment 안에만 포함된다 (식별자 분산 방지 — Rationale "Cafe24 App URL 상세 페이지 표시" 참조). |
 | PATCH | `/api/integrations/:id` | 별칭 등 메타 수정 |
 | DELETE | `/api/integrations/:id` | 삭제 (사용처 있으면 409) |
 | POST | `/api/integrations/:id/test` | 현재 저장된 자격 증명으로 연결 테스트 |
@@ -967,7 +968,7 @@ Cafe24 Private 의 "테스트 실행" 흐름은 `pending_install` 행이 이미
 
 Cafe24 Developers 의 앱 등록 → "테스트 실행" 까지의 사용자 작업 텀을 최대 1일로 가정한다. 더 길면 stale `pending_install` 행이 누적되어 §9.2 의 식별 키 룩업 성능과 §2.4 attention 카운트에 잡음. 더 짧으면 정상 흐름이 끊긴다 (사용자가 점심·미팅·휴일 사이클에 작업이 분할되기 쉬움). 24h 가 지나면 `status='expired'`, `status_reason='install_timeout'`, `install_token=NULL` 로 자동 전이. 만료된 행은 데이터 분석·감사 목적으로 삭제하지 않고 보존한다 (manual delete 별도).
 
-**TTL 기준 (2026-05-15 갱신)**: `install_token_issued_at` 컬럼 (V044) 을 기준으로 한다 — `created_at` 이 아닌 토큰 발급 시각. 변경 3 (중복 pending_install 재사용) 으로 같은 mall_id 의 begin 재호출이 기존 row 의 install_token 만 갱신할 때, 새 토큰이 발급되자마자 24h 카운트가 끝나 있는 문제를 해소. callback 성공 시 `install_token` 과 함께 `install_token_issued_at` 도 NULL 로 비워진다. 옛 (V044 이전) 행은 NULL — 스캐너 SQL 이 `COALESCE(install_token_issued_at, created_at)` 로 fallback 해 legacy 의미를 유지.
+**TTL 기준 (2026-05-15 갱신, 2026-05-16 보강)**: `install_token_issued_at` 컬럼 (V044) 을 기준으로 한다 — `created_at` 이 아닌 토큰 발급 시각. 변경 3 (중복 pending_install 재사용) 으로 같은 mall_id 의 begin 재호출이 기존 row 의 install_token 만 갱신할 때, 새 토큰이 발급되자마자 24h 카운트가 끝나 있는 문제를 해소. callback 성공 시 `install_token` 과 `install_token_issued_at` 모두 **보존**된다 (2026-05-16 갱신 — 옛 NULL 처리 기술은 "install_token persistent 격상" 결정과 미정합 표기 잔존이었다) — post-install navigation 의 식별 키이며, 24h TTL 스캐너는 `status='pending_install'` row 만 대상으로 하므로 connected 전이 후의 값이 잘못된 만료 처리에 영향을 주지 않는다. NULL 처리는 `pending_install → expired (install_timeout)` 만료 경로에서만 발생한다. 옛 (V044 이전) 행은 `install_token_issued_at` NULL — 스캐너 SQL 이 `COALESCE(install_token_issued_at, created_at)` 로 fallback 해 legacy 의미를 유지.
 
 `status_reason='install_timeout'` 인 expired 행에서는 reauthorize 버튼이 **비활성** 이다 — Private 앱은 재인증 진입점이 없고 cafe24 "테스트 실행" 만 정식이다. 사용자는 행을 삭제 후 새로 등록한다.
 
@@ -1147,3 +1148,50 @@ PR #75/#76 의 spec 표현 ("expired 전이 두 경로 — token_expired, instal
 기각된 옵션 (install_timeout 알림 발사): UI 배지로 충분히 통지되는 자기-시작 상태에 알림을 더하면 over-noise. 향후 별도 도메인 알림 (예: `integration_action_required`) 신설 시 재검토 가능.
 
 **범위**: 본 결정은 `Notification.type='integration_expired'` 미발사만 다룬다. UI 배지·다음 install 시도 시 `install_token=NULL` 로 인한 404 등 다른 동작은 영향 없음.
+
+### Cafe24 App URL 상세 페이지 표시 (2026-05-16)
+
+Cafe24 admin "앱으로 가기" / Cafe24 Developers "테스트 실행" 의 HMAC 검증 실패 에러 페이지(`renderInstallErrorHtml`) 는 사용자에게 "통합 상세 페이지에 표시된 URL 과 일치하는지 확인하세요" 라고 안내한다. 그러나 옛 상세 페이지에는 App URL 이 표시되지 않아 안내가 실효성을 잃었다 (2026-05-16 사용자 보고 — App URL 호출이 `CAFE24_INSTALL_INVALID_HMAC` 으로 거부됐을 때 비교 기준이 없었다).
+
+**해결안**: 상세 페이지 Overview 탭에 `Cafe24AppUrlCard` 를 추가해 App URL/Redirect URI 를 복사 버튼과 함께 노출 (§4.2 표 참조). 백엔드는 `IntegrationDto.appUrl: string | null` 필드를 Cafe24 Private 한정으로 계산해 응답에 포함하며, `install_token` 자체는 별도 필드로 노출하지 않는다 — App URL path segment 안에 이미 포함되며 별도 필드 노출은 (a) 중복, (b) 식별자가 두 곳에 분산되어 클라이언트가 어느 값으로 비교해야 할지 혼동, (c) 향후 path 형식 변경 시 양쪽 필드 동기화 부담, 세 가지 이유로 회피.
+
+**새 등록 흐름과의 일관성**: `frontend/src/app/(main)/integrations/new/page.tsx` 의 `Cafe24PrivatePending` 컴포넌트와 동일한 복사 UX 패턴(라벨 + 모노스페이스 URL + 복사 버튼 + 1줄 안내) 을 재사용해 사용자 혼동을 줄인다.
+
+**HMAC 검증 진단 로그 보강**: 본 변경과 함께 `handleInstall` 의 HMAC 실패 3 분기 (mall_id 불일치 / client_secret 부재 / HMAC 자체 불일치) 가 동일 `CAFE24_INSTALL_INVALID_HMAC` 응답을 반환하는 옛 동작은 유지하되 (응답 코드 단일화 정책 유지 — capability-token 가정 보호), `logger.warn` 로 어느 분기인지·URL mall_id 와 DB mall_id 의 일치 여부·DB app_type/status/status_reason·install_token prefix+suffix 4자를 기록한다. `client_secret` 자체는 절대 로그에 남기지 않는다 — `SECRET_LEAK_PATTERNS` 정책과 일관 (보안 로깅 규약의 spec/conventions 정식화는 별도 plan).
+
+### HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)
+
+PR #67 의 SEC H-1 (2026-05-16) 가 HMAC 검증을 "Java `URLEncoder.encode(value, "UTF-8")` 호환 (공백 `+`)" 으로 정정했으나, 운영 환경에서 **신규 통합 직후 즉시 HMAC 실패** 가 재현됐다 (사용자 보고, 2026-05-16 — PR #89 의 진단 로그가 `reason=hmac_verify_failed` 를 정확히 식별). mall_id / app_type / install_token / client_secret 모두 매칭하는데 HMAC 자체만 불일치 — 알고리즘 자체의 결함.
+
+**근본 원인**: Cafe24 의 공식 `validationCheckHmac` Java 샘플은 `request.getQueryString()` 을 `&` 로 split → `=` 로 한 번만 split → TreeMap 에 **raw value 그대로** 저장한 뒤 concat 한다. 즉 **URL value 를 decode 하지 않으며 re-encode 도 하지 않는다**. 우리 SEC H-1 fix 는 "Cafe24 가 URLEncoder 를 호출한다" 라고 가정했지만, 실제로는 URL 의 raw byte sequence 를 그대로 HMAC 메시지에 넣는다.
+
+**증거**: 사용자 보고 URL 의 `user_name=%EB%8C%80%ED%91%9C%20%EA%B4%80%EB%A6%AC%EC%9E%90` — Cafe24 가 공백을 `%20` 으로 보낸다. 만약 Cafe24 가 HMAC 계산에 URLEncoder 를 호출한다면 메시지 안의 값은 `%EB%8C%80%ED%91%9C+%EA%B4%80%EB%A6%AC%EC%9E%90` 가 되어야 하고, 그 결과 Cafe24 자신의 HMAC 도 자기네 URL 과 매칭이 안 되어 검증이 동작하지 않을 것이다. 따라서 Cafe24 는 raw 값을 사용한다 (이론적 추론 + 운영 재현 동시 확인).
+
+**해결**: `buildHmacMessage` 가 `URLSearchParams` 로 decode 하지 않고 `rawQuery.split('&')` 로 직접 파싱해 key/value 의 raw byte string 을 그대로 보존한다. sort 는 key 만 알파벳 순. value 인코딩은 Cafe24 가 어떤 인코더로 URL 을 만들었든 무관 — byte 단위로 일치하기만 하면 된다.
+
+```typescript
+function buildHmacMessage(rawQuery: string): string {
+  return rawQuery
+    .split('&')
+    .map((part) => {
+      const eqIdx = part.indexOf('=');
+      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
+      return { key, raw: part };
+    })
+    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
+    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
+    .map((p) => p.raw)
+    .join('&');
+}
+```
+
+**기각된 옵션 (raw 보존 대신 다양한 인코더 시도)**: `encodeURIComponent` / `URLEncoder` 호환 / browser fetch encoding 등 후보 인코더가 매번 차이가 있어 (`%20` vs `+`, `*` vs `%2A`, `!` vs `%21` 등) 어느 하나로 매칭이 보장되지 않는다. Cafe24 자체도 향후 인코더를 바꿀 수 있다. raw byte 보존은 인코더 invariant 다.
+
+**보안 영향 없음**: HMAC 자체의 cryptographic strength 는 변하지 않는다. capability-token 보호 ([Rationale "CAFE24_INSTALL_INVALID_TOKEN(404) 의 보안 전제"](#cafe24_install_invalid_token404-의-보안-전제-2026-05-14)) 도 그대로. 옛 PR #67 의 SEC H-2 (workspace 횡단 enumeration 방지) 도 그대로.
+
+**테스트 보강**: 사용자 실제 URL (`user_name=...%20...` + 실제 timestamp 패턴) 의 회귀 보호 테스트 추가. 옛 `accepts HMAC for queries containing space-encoded values` 테스트는 `John+Doe` 형식을 사용했으나 — 그건 우리 옛 알고리즘의 self-fulfilling 검증 (compute 와 verify 가 같은 broken 알고리즘 사용) 이라 실제 Cafe24 동작 검증이 안 됐다. 새 테스트는 **Cafe24 가 보내는 형식 (`%20`) 그대로** raw query 를 만들어 검증한다.
+
+**관련 history**:
+- 2026-05-14: HMAC 알고리즘 최초 도입 (`encodeURIComponent` 사용, 운영 양호)
+- 2026-05-16 (PR #67 SEC H-1): `formUrlEncode` 로 변경 (잘못된 가정에 기반한 회귀)
+- 2026-05-16 (본 결정): raw-value 보존으로 재정정 (Cafe24 실제 동작 반영)

```

---

### 파일 31: spec/4-nodes/4-integration/4-cafe24.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/4-nodes/4-integration/4-cafe24.md b/spec/4-nodes/4-integration/4-cafe24.md
index d7851af8..e3e731e9 100644
--- a/spec/4-nodes/4-integration/4-cafe24.md
+++ b/spec/4-nodes/4-integration/4-cafe24.md
@@ -54,9 +54,10 @@
 - Integration 드롭다운: `IntegrationSelector` 의 `serviceTypes=['cafe24']` 필터 (Cafe24 만 표시).
 - Resource 드롭다운: 18 카테고리. 메타데이터에 정의된 라벨 표시 (예: `product` → "Product (상품)").
 - Operation 드롭다운: Resource 변경 시 동적 갱신. 메타데이터의 (resource, operation) → label 매핑.
-- Fields: Operation 선택 시 메타데이터의 입력 스키마(JSON Schema 호환 형식) 로 동적 폼 렌더. Required / Optional 두 그룹으로 분리.
-  - **편집 버퍼**: UI 는 내부적으로 `Array<{key, value}>` 편집 버퍼를 React state 로 관리하고, `onChange` 시 빈 key 행을 제거한 뒤 `Record<string, unknown>` 로 변환해 `config.fields` 에 저장한다. 빈 key 행을 즉시 버퍼에서 떨어뜨리지 않도록 해 "추가" 버튼이 행을 즉시 보여준다 (배경: §9.9).
-- Pagination: operation 메타데이터에 `paginated: true` 가 있을 때만 표시.
+- Fields: Operation 선택 시 메타데이터의 입력 스키마(JSON Schema 호환 형식) 로 동적 폼 렌더. Required / Optional 두 그룹으로 분리. 각 필드는 `ExpressionInput` 베이스 위젯을 사용하여 표현식(`{{ }}`) 입력을 모든 칸에서 허용하며, `enum` / `boolean` / `default` 정보는 hint 텍스트로 표면화한다. 키는 메타데이터로 고정되므로 사용자가 임의 key 를 추가하는 경로는 없다 (배경: §9.9).
+  - **호환 키 보존**: Operation 변경 시 새 op 의 `fields[].name` 과 교집합인 키만 유지하고 무관 키는 drop. 예) `product_get` (shop_no 만) → `product_list` (shop_no + display + ...) 전환 시 `shop_no` 값은 유지된다.
+- Operation 후보 표시: 카탈로그 (`spec/conventions/cafe24-api-catalog/`) 의 `status: planned` 행도 dropdown 에 노출하되 disabled + "(지원 예정)" 접미사로 구분. resource 옆에 "지원 N개 · 추후 지원 M개" coverage hint.
+- Pagination: operation 메타데이터에 `paginated: true` 가 있을 때만 표시. supported 가 아닌 operation (planned / unknown) 선택 시 fields/pagination 미렌더.
 
 ## 3. 포트
 
@@ -424,34 +425,33 @@ Cafe24 는 App URL 호출 시 **HmacSHA256 + Base64** 서명(`hmac` 파라미터
 
 **알고리즘 (공식 문서 + 공식 Java 샘플 기준):**
 
-1. `hmac` 파라미터를 제외한 나머지 쿼리 파라미터를 **알파벳순 정렬**
-2. **form-urlencoded** query string 형태로 직렬화: `key=URLencoded-value&...`. 값 인코딩은 Java `URLEncoder.encode(value, "UTF-8")` 호환 — `application/x-www-form-urlencoded` MIME 규약 (공백 → `+`).
+1. `hmac` 파라미터를 제외한 나머지 쿼리 파라미터를 **알파벳순 정렬** (key 기준)
+2. **원본 URL-encoded 값을 그대로 보존** 해서 query string 형태로 직렬화: `key=raw-value&...`. **decode/re-encode 금지** — Cafe24 의 공식 Java 샘플 `validationCheckHmac` 는 `request.getQueryString()` 을 `&` 로 split 한 뒤 `=` 로 한 번만 split 해서 value 부분을 **raw 그대로** TreeMap 에 저장한다. 즉 Cafe24 가 URL 에 `%20` 으로 보냈으면 HMAC 메시지에도 `%20`, `+` 로 보냈으면 `+` 그대로 유지된다. value 의 의미를 해석하지 않고 byte 단위로 매칭하는 게 정답. **재정정 배경**은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항 참조.
 3. `client_secret` 을 키로 HmacSHA256 해싱
 4. 결과를 **Base64 인코딩**
 5. URL-decoded `hmac` 파라미터 값과 timing-safe 비교
 
 ```typescript
-// (2026-05-16 갱신) `encodeURIComponent` 는 공백을 `%20` 으로 인코딩하지만
-// Cafe24 공식 Java 샘플의 `URLEncoder.encode` 는 공백을 `+` 로 인코딩한다.
-// `formUrlEncode` 로 정정하지 않으면 user_name 등 공백 포함 정상 요청이
-// HMAC 불일치로 거부된다 (PR #67 SEC H-1).
-function formUrlEncode(value: string): string {
-  return encodeURIComponent(value)
-    .replace(/%20/g, '+')
-    .replace(/!/g, '%21')
-    .replace(/'/g, '%27')
-    .replace(/\(/g, '%28')
-    .replace(/\)/g, '%29')
-    .replace(/~/g, '%7E');
+// (2026-05-16 재정정) Cafe24 는 URL 의 값을 decode/re-encode 없이 raw 그대로
+// HMAC 메시지에 사용한다. URLEncoder 호환 인코더 (PR #67 SEC H-1) 가정은
+// 오류였으며 (사용자 보고 — 신규 통합 직후 HMAC 실패), 운영 URL 의 `%20` 이
+// 메시지 안에서 `+` 로 변환되어 byte 불일치를 일으켰다. raw 보존이 invariant.
+function buildHmacMessage(rawQuery: string): string {
+  return rawQuery
+    .split('&')
+    .map((part) => {
+      const eqIdx = part.indexOf('=');
+      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
+      return { key, raw: part };
+    })
+    .filter((p) => p.key.length > 0 && p.key !== 'hmac')
+    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
+    .map((p) => p.raw)
+    .join('&');
 }
 
 function verifyHmac(rawQuery: string, clientSecret: string, receivedHmac: string): boolean {
-  const params = new URLSearchParams(rawQuery);
-  params.delete('hmac');
-  const message = [...params.entries()]
-    .sort(([a], [b]) => a.localeCompare(b))
-    .map(([k, v]) => `${k}=${formUrlEncode(v)}`)
-    .join('&');
+  const message = buildHmacMessage(rawQuery);
   const computed = createHmac('sha256', clientSecret).update(message, 'utf8').digest('base64');
   return timingSafeEqual(Buffer.from(computed), Buffer.from(receivedHmac));
 }
@@ -471,15 +471,17 @@ function verifyHmac(rawQuery: string, clientSecret: string, receivedHmac: string
 |------|-----|------|
 | `RECOVERY_CANDIDATE_LIMIT` | `5` (코드 상수, 환경변수 아님) | install_token mismatch 회복 흐름의 HMAC trial 상한. workspace 횡단으로 같은 mall_id 가 5건 초과면 회복 포기 (DoS amplification 차단). 정상 운영에서 mall_id 당 cafe24 row 는 보통 1~2건. |
 
-### 9.9 Fields 편집 UI 의 내부 버퍼 분리
+### 9.9 Fields 편집 UI — 메타데이터 기반 typed 동적 폼
 
 대안:
-- (A) `config.fields` 를 그대로 컴포넌트 state 의 원천으로 사용 — 빈 key 행이 object 변환 시 즉시 제거되어 "추가" 버튼이 행을 보여주지 못한다 (PR #62 가 해결한 버그).
-- (B, 채택) **내부 편집 버퍼** — `Array<{key, value}>` 형태로 React state 에 유지. `onChange` 시 빈 key 행을 제거하고 `Record<string, unknown>` 로 변환해 `config.fields` 에 propagate. 외부에서 `config.fields` 가 다른 reference 로 바뀌면 (undo/redo, 프로그래밍적 reset) 다음 렌더에서 버퍼를 재동기화한다.
+- (A) **자유 key/value 행 입력** (옛 KeyValueEditor 패턴, PR #62) — 사용자가 키 이름을 외워서 입력. 빈 key 행을 위한 내부 편집 버퍼(`Array<{key, value}>`) 분리가 필요했음. 메타데이터가 frontend 에 없으니 어느 키가 필수/선택인지 UI 가 안내하지 못했다.
+- (B, 채택) **operation 메타데이터 기반 동적 폼** (PR #88, 2026-05-16) — Phase 2 의 `extras.operationsByResource` 페이로드로 (resource, operation) 별 `fields[]` 가 frontend 에 도달한다. UI 는 메타데이터에 명시된 키만 행으로 렌더하고 required / optional 두 그룹으로 분리. 사용자가 임의 key 를 추가하는 경로 자체가 없어 (A) 의 빈 key 행 / 편집 버퍼 문제는 구조적으로 소멸. 모든 값 입력칸은 `ExpressionInput` 베이스로 표현식 (`{{ }}`) 입력을 유지한다.
+
+**적용 범위 변경 (2026-05-16)**: 옛 결정 (A → B 분리 버퍼) 은 cafe24 노드가 KeyValueEditor 를 사용하던 시기에 한정된 문제였다. Phase 3 의 동적 폼 채택으로 cafe24 노드에서 KeyValueEditor 의존을 완전히 제거했고, 다른 통합 노드 (`http_request` 의 `headers` / `queryParams`) 는 처음부터 `KeyValue[]` 형태로 직렬화하여 본 결정의 대상이 아니었다 (빈 key 행도 그대로 echo). 따라서 옛 "object-shaped backend contract + KeyValueEditor UI" 패턴은 본 프로젝트에서 더 이상 사용되지 않는다. 향후 같은 시나리오 (메타데이터 부재 + object 직렬화 + 사용자 자유 key 입력) 가 다시 필요해질 경우 본 절의 (A) 안을 재검토할 수 있다.
 
-**적용 범위**: 본 결정은 **object-shaped backend contract** (`config.X: Record<string, unknown>`) 를 가진 통합 노드에 한정한다. `http_request` 의 `headers` / `queryParams` 처럼 `KeyValue[]` 형태로 직렬화하는 노드는 빈 key 행도 그대로 echo 되므로 본 버퍼 분리 패턴 적용 대상 외다. backend 가 받는 직렬화 형식 (`Record<string, unknown>`) 은 불변이다 (§1 config 스키마 — 변경 시 본 결정 재검토 필요).
+**호환 키 보존 (Phase 3 추가 결정)**: Operation 변경 시 fields 를 전부 reset 하면 같은 키를 다음 operation 도 받는 경우 사용자가 다시 입력해야 함. 새 op 의 `fields[].name` 과 현재 `config.fields` 의 키 집합의 **교집합** 만 유지해 ("product_get → product_list" 같은 점진 전환에서 `shop_no` 등 공통 키 보존) 무관 키는 drop. Resource 변경 시는 의미 단절이 너무 커 fields 전체 reset.
 
-> 출처: consistency-check 세션 `review/consistency/2026/05/16/09_03_04/SUMMARY.md` (INFO 1·2 — cross_spec + rationale_continuity 동일 위배 통합).
+> 출처: consistency-check 세션 `review/consistency/2026/05/16/09_03_04/SUMMARY.md` (옛 A→B 분리 결정), `review/consistency/2026/05/16/13_09_46/SUMMARY.md` (B 채택 + Phase 3 호환 키 보존 결정).
 
 ## 10. CHANGELOG
 
@@ -494,3 +496,5 @@ function verifyHmac(rawQuery: string, clientSecret: string, receivedHmac: string
 | 2026-05-16 | spec drift 정리 (PR #56/#67 머지 후속). §4 step 6 — refresh 실패 status 전이를 `expired` 에서 `error(auth_failed)` / `error(network)` 로 정정 (REQ HIGH-2). §9.6 — 옛 "Redis 분산 mutex 별도 spec" 미결을 BullMQ `cafe24-token-refresh` 큐 (jobId dedup) 도입으로 해소 (SPEC-3). §9.8 — HMAC 검증 코드를 `formUrlEncode` (Java URLEncoder 호환) 로 정정 (PR #67 SEC H-1), `tryRecoverByMallId` 회복 흐름 + `RECOVERY_CANDIDATE_LIMIT=5` ENV 표 추가 (SPEC-1, PR #67 SEC H-2). 자세한 결정 배경은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) 의 신규 항목 4건 참조. consistency-check 세션: `review/consistency/2026/05/16/11_11_07/` (Critical 0). |
 | 2026-05-16 (후속) | 본문 정리 (코드/계약 무변경) — §2 설정 UI 에 fields 편집 버퍼 분리 원칙 한 줄 추가, §9 Rationale 에 §9.9 (Fields 편집 UI 의 내부 버퍼 분리) 신설 (PR #62 후속). §9.7 OAuth scope wire format 본문 위치 정정 (편집 오류 수정 — §9.8 뒤에 orphan 으로 있던 본문을 §9.7 헤더 바로 뒤로 이동, 내용 변경 없음). 출처: `review/consistency/2026/05/16/09_03_04/SUMMARY.md` INFO 1·2. §5 Case sparse 번호 (5.1·5.3·5.8) 는 4 integration 노드 공유 컨벤션으로 확인되어 변경하지 않음 (consistency 세션 `review/consistency/2026/05/16/11_36_49/`). |
 | 2026-05-16 (catalog) | §9.3 Resource/Operation 메타데이터 위치 갱신 — Cafe24 Admin API 전수 카탈로그 [`spec/conventions/cafe24-api-catalog/`](../../conventions/cafe24-api-catalog/_overview.md) 신설(18 resource × supported 53 + planned ~300). backend `catalog-sync.spec.ts` 양방향 동기 테스트 도입. 노드 UX 개편 plan: `plan/in-progress/cafe24-node-resource-operation-ux.md`. |
+| 2026-05-16 (ux-cleanup) | §2 / §9.9 본문 정리 — Phase 3 (PR #88, Cafe24Config 재작성) 가 옛 KeyValueEditor + 편집 버퍼 패턴을 완전히 폐기했으므로 §2 의 "편집 버퍼" 줄을 제거하고 메타데이터 기반 typed 동적 폼 + 호환 키 보존 동작으로 교체. §9.9 도 (A) 옛 자유 key/value 입력 / (B) 메타데이터 기반 동적 폼 두 안의 비교로 재작성하여 채택안을 (B) 로 명시. 옛 §9.9 의 "object-shaped contract + 편집 버퍼" 패턴은 본 프로젝트에서 더 이상 사용되지 않음을 명시. 호환 키 보존 결정 추가. consistency-check 세션: `review/consistency/2026/05/16/13_29_47/`. |
+| 2026-05-16 (hmac-raw-fix) | §9.8 HMAC 검증 알고리즘 **재정정** — PR #67 SEC H-1 의 "Java URLEncoder 호환 (공백 `+`)" 가정이 오류였음. Cafe24 공식 샘플은 URL 의 값을 decode/re-encode 없이 raw 그대로 HMAC 메시지에 사용한다 (`request.getQueryString()` split → TreeMap 보존). 운영 사용자 보고 (2026-05-16) — Cafe24 가 URL 에 `%20` 으로 공백을 인코딩해 보내는데 우리는 `+` 로 변환해 메시지 불일치. raw-value 보존 방식으로 재정정. 자세한 결정 배경은 [Spec 통합 화면 ## Rationale](../../2-navigation/4-integration.md#rationale) "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)" 항. consistency-check 세션: `review/consistency/2026/05/16/14_06_49/`. |

```

---

### 파일 32: spec/data-flow/5-integration.md
- 변경 유형: Review
- 언어: md

#### 변경된 코드
```
diff --git a/spec/data-flow/5-integration.md b/spec/data-flow/5-integration.md
index 09d44a8a..1d622539 100644
--- a/spec/data-flow/5-integration.md
+++ b/spec/data-flow/5-integration.md
@@ -87,7 +87,7 @@ sequenceDiagram
     Svc->>PG: SELECT+DELETE state
     Svc->>Prov: token exchange
     alt 토큰 교환 성공
-      Svc->>PG: UPDATE integration SET status=connected, install_token=NULL, credentials ENC, token_expires_at, last_rotated_at
+      Svc->>PG: UPDATE integration SET status=connected, credentials ENC, token_expires_at, last_rotated_at<br/>(install_token + install_token_issued_at 보존 — post-install navigation 식별 키)
     else 토큰 교환 실패
       Svc->>PG: UPDATE integration SET status_reason='oauth_token_exchange_failed', last_error={code,message,at} (status 는 pending_install 유지, install_token 도 유지)
     end

```
