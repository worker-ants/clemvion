# 정식 규약 준수 검토 — `plan/in-progress/webhook-public-ip-failopen-hardening.md`

검토 대상: 프롬프트 페이로드에 포함된 plan 문서 초안 (spec draft 검토 모드)  
검토 기준: `spec/conventions/**`·`CLAUDE.md`·`.claude/docs/plan-lifecycle.md`

---

## 발견사항

### **[WARNING]** `worktree` 필드 값이 실제 slug 로 교체되지 않았음
- **target 위치**: frontmatter `worktree: webhook-public-ip-failopen-3800c4`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — "착수 시 실제 `<task>-<slug>` 로 교체". 또한 `plan-frontmatter.test.ts` 가 강제하는 sentinel 허용값은 `(unstarted)` 이며, 실제 worktree 명이 기재돼 있다면 해당 worktree 디렉토리가 존재해야 guard 가 통과한다.
- **상세**: 초안(프롬프트 내 버전)의 frontmatter 는 `worktree: webhook-public-ip-failopen-3800c4` 로 기재돼 있다. 반면 현재 디스크상의 실제 파일(`plan/in-progress/webhook-public-ip-failopen-hardening.md`)은 `worktree: (unstarted)` sentinel 을 유지하고 있다. 두 버전이 다르다는 점에서, 초안이 plan-lifecycle §4 에 맞게 worktree 실착수 후 갱신된 것이라면 문제없으나, 미착수 단계의 초안에 실 worktree slug 를 삽입한 경우 `(unstarted)` sentinel 을 건너뛰고 직접 기재한 것이 된다. 이 자체는 규약 위반은 아니지만 guard 에 통과하려면 해당 worktree 폴더가 실제 존재해야 하므로, 초안 단계 문서라면 `(unstarted)` 를 유지하거나 실착수와 동시에 교체하는 방식이 규약에 더 부합한다.
- **제안**: plan 초안(미착수 단계)으로 제출된다면 `worktree: (unstarted)` 유지. 실착수 시점에 `worktree: webhook-public-ip-failopen-3800c4` 로 교체. 두 상태 사이의 draft 단계에는 sentinel 을 사용한다.

---

### **[WARNING]** `branch` 필드는 plan frontmatter 스키마에 정의되지 않은 임의 필드
- **target 위치**: frontmatter `branch: claude/webhook-public-ip-failopen-3800c4`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 필수 필드는 `worktree`·`started`·`owner` 세 가지. 추가 필드(`priority`/`status`/`title` 등)는 허용되나, 스키마에 열거된 필드가 아니다.
- **상세**: `branch:` 필드는 plan-lifecycle §4 에 선례로 열거된 선택 필드(`priority`/`status`/`title`)에도 포함되지 않는다. `plan-frontmatter.test.ts` 가드는 의무 3필드의 존재만 강제하므로 build 차단은 없으나, 관례에 없는 필드를 추가하면 다른 plan 과의 일관성이 깨진다.
- **제안**: `branch:` 필드를 제거하거나, worktree 명에서 branch 명이 유도된다는 점에서 중복 정보이므로 생략. 반드시 기재해야 한다면 관례 추가를 plan-lifecycle §4 에 명문화한 후 사용.

---

### **[INFO]** Phase A spec 체크리스트 항목이 spec 경로 규약과 일치하는지 확인 필요
- **target 위치**: `## Phase → ### A. spec 반영 (planner)` 의 S-1~S-4 항목
- **위반 규약**: CLAUDE.md "정보 저장 위치" — `spec/<영역>/_product-overview.md` 또는 `spec/<영역>/*.md`
- **상세**: S-1·S-2 는 `7-channel-web-chat/4-security.md` 를 SoT 로 참조하고, S-3 은 `5-system/12-webhook.md`, S-4 는 `5-system/1-auth.md` 를 참조한다. 경로 형식 자체는 규약에 부합하나, `7-channel-web-chat/4-security.md §4` 가 공개 webhook IP rate-limit 의 SoT 로 타당한지는 spec 내용 정합성 이슈이므로 `--spec` 일관성 검토에서 별도 검증이 필요하다. 본 규약 준수 검토에서는 파일명 규칙(`숫자-kebab.md` 패턴)은 이상 없음.
- **제안**: 특이 사항 없음. 일관성 검토(`/consistency-check --spec`)로 SoT 배치 타당성을 확인할 것 (Phase A 마지막 체크리스트 항목에 이미 기재되어 있음).

---

### **[INFO]** 문서 구조 — Overview/본문/Rationale 3섹션 권장 미적용
- **target 위치**: plan 문서 전체 구조
- **위반 규약**: CLAUDE.md "정보 저장 위치" 및 각 SKILL.md 의 "Spec 문서 3섹션 구성"
- **상세**: plan 문서는 spec 문서가 아니라 작업 추적 문서이므로 3섹션(Overview / 본문 / Rationale) 권장은 spec 파일(`spec/**/*.md`)에 적용되는 것이지 `plan/in-progress/*.md` 에 의무로 적용되지 않는다. 본 plan 문서는 `## 배경`, `## 결정`, `## 설계`, `## Phase`, `## 범위 경계` 구조로 작성됐으며, plan 형식으로서는 적절하다. 3섹션 위반 아님.
- **제안**: 별도 조치 불필요. 참고 차원에서 기재.

---

### **[INFO]** 파일명과 제목의 경미한 불일치
- **target 위치**: 파일명 `webhook-public-ip-failopen-hardening.md` vs 문서 제목 `# 공개 webhook IP 미식별 fail-open 강화 (D-12)`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `id:` 는 "파일 basename 기반 권장"이나 이는 spec 문서의 `id:` 필드에 관한 것이다. plan 문서 파일명 자체에 대한 명명 규약은 별도로 없음.
- **상세**: 제목의 `(D-12)` 태그가 파일명에는 없다. 식별 혼동을 유발할 수 있으나 규약 위반은 아니다. `plan-frontmatter.test.ts` 도 제목-파일명 일치를 검증하지 않는다.
- **제안**: 선택 사항. 일관성 선호 시 파일명을 `webhook-public-ip-failopen-hardening-d12.md` 로 하거나 제목의 `(D-12)` 를 제거.

---

## 요약

본 plan 문서(`plan/in-progress/webhook-public-ip-failopen-hardening.md`)는 plan-lifecycle 의 필수 frontmatter 3필드(`worktree`·`started`·`owner`)를 모두 포함하고 있으며, Phase A~B 체크리스트·범위 경계·결정 사항의 문서 구조는 plan 형식으로 적절하다. 정식 규약 중 직접 위반(CRITICAL)에 해당하는 항목은 없다. 다만 스키마에 정의되지 않은 `branch:` 필드 추가(WARNING)와, 초안 단계에서 worktree sentinel(`(unstarted)`) 대신 실 slug 를 기재하는 패턴(WARNING)이 plan-lifecycle §4 의 의도와 거리감이 있다. spec 경로 참조(`7-channel-web-chat/4-security.md`, `5-system/12-webhook.md` 등)의 배치 타당성은 `--spec` 일관성 검토의 범주로, 규약 준수 관점에서는 경로 형식 자체에 이상 없다.

---

## 위험도

LOW
