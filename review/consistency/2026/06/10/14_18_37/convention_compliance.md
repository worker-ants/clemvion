# 정식 규약 준수 검토 — spec-draft-unified-model-management.md

검토 대상: `plan/in-progress/spec-draft-unified-model-management.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-10

---

## 발견사항

### [CRITICAL] plan frontmatter 완전 누락
- **target 위치**: 파일 최상단 — frontmatter 블록 없음 (파일은 `# Spec Draft — …` 로 바로 시작)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` + `spec/conventions/spec-impl-evidence.md §4.2 plan-frontmatter.test.ts` (build guard)
- **상세**: `plan/in-progress/<name>.md` 최상위 파일은 `worktree`, `started`, `owner` 세 필드를 frontmatter YAML 블록으로 반드시 포함해야 한다. `plan-frontmatter.test.ts` 가 이를 빌드 차단 수준으로 강제한다. 대조 파일인 `spec-draft-rag-dynamic-cut.md`, `spec-draft-conventions-code-data.md` 모두 frontmatter를 정상 보유하고 있으나, 본 파일에는 전혀 없다.
- **제안**: 파일 최상단에 아래 블록 추가.
  ```yaml
  ---
  worktree: unified-model-mgmt-5af7ee
  started: 2026-06-10
  owner: project-planner
  ---
  ```

---

### [WARNING] 마이그레이션 번호 V088–V092가 고정 기술되어 구현 시 race 유발 위험
- **target 위치**: `## 변경 0 — 마이그레이션 보강` 항목 전체 (V088~V092 언급)
- **위반 규약**: `spec/conventions/migrations.md §2` (단조 증가·gap 금지), `§5` (새 마이그레이션 추가 절차)
- **상세**: 현재 main의 max V번호는 V087(`V087__execution_resume_call_stack.sql`)이다. Draft가 V088~V092를 고정 기술하면 구현자가 번호를 그대로 사용할 때, 동 기간 다른 PR이 V088을 점유하면 번호 충돌이 발생한다. 또한 V092는 "cleanup, PR4"로 분리 예고되어 있어 V088~V091 머지 후 V092 점유 윈도우가 길어지면 `migrations.md §6.3` 사후 안전망이 충돌을 경고할 수 있다. Migrations 규약 §5는 "git fetch && git rebase" 후 당시 max+1부터 할당하도록 명시한다 — draft에 고정 번호를 쓰면 이 절차와 충돌한다.
- **제안**: Draft에서 `V088`~`V092`를 상대 표기(예: `V<max+1>`, `V<max+2>` 등)로 바꾸거나, "구현 착수 시 `migrations.md §5` 절차에 따라 당시 max+1부터 재할당" 주의 문구를 명시한다.

---

### [WARNING] API endpoint — `set-default` 동사형 sub-path 패턴
- **target 위치**: `## 변경 2 — §3 API (개정)` 표, `PATCH /api/model-configs/:id/set-default` 행
- **위반 규약**: `spec/conventions/swagger.md §2-1~2-4` REST 패턴 권장 (명사형 경로 + HTTP 메서드 의미 활용). 직접 금지 규정은 없으나 기존 api-convention 패턴과의 거리감.
- **상세**: `/set-default`는 동사형 sub-path로, REST 관용에서 선호하는 명사형(`/default`) + `PUT/PATCH`와 다르다. 기존 spec에 이미 이 패턴이 존재하여 유지하는 것이라면 기술 근거(기존 패턴 유지)를 draft 내에 명시하는 것이 좋다.
- **제안**: `/api/model-configs/:id/default` + `PUT`(또는 `PATCH`)으로 명사형 변경을 검토하거나, 기존 spec에 이 패턴이 이미 허용된 선례임을 draft 본문에 1줄 추가한다.

---

### [INFO] `spec/data-flow/` 경로 — spec-impl-evidence frontmatter 가드 적용 여부 미확인
- **target 위치**: `## 변경 3` 표의 `spec/data-flow/6-knowledge-base.md` 참조
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` (적용 대상 목록)
- **상세**: `spec-impl-evidence.md §1`의 frontmatter 의무 적용 대상 목록에 `spec/data-flow/`는 없다(`spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/7-channel-web-chat/`, `spec/conventions/`만 열거). `spec/data-flow/6-knowledge-base.md`가 가드 면제 경로인지, 또는 기 등록된 상태인지를 draft가 명시하지 않는다.
- **제안**: 구현 전 `spec/data-flow/6-knowledge-base.md`의 frontmatter 상태(id/status 보유 여부)를 확인하고, 가드 면제 경로라면 draft에 "(frontmatter 가드 면제 경로 확인)" 노트 추가.

---

### [INFO] `rerank_llm_config_id` 필드명 — `_llm_` 잔존으로 인한 의미 오해 가능성
- **target 위치**: `## 변경 1 §2.16.1` — "rerank_llm_config_id·extraction_llm_config_id: chat kind 참조 → 타깃이 model_config로 자동 추종, 컬럼명·의미 불변"
- **위반 규약**: 직접 위반 규약 없음. `spec/conventions/error-codes.md §1`의 "의미를 기술하는 명명" 원칙과 유사한 일관성 맥락.
- **상세**: `rerank_llm_config_id`는 model_config 통합 후 chat kind를 가리키는 FK인데 필드명에 `_llm_`이 남아 의미 오해 가능성이 있다. UUID 보존으로 컬럼명을 유지하는 것은 호환성상 합리적이고 draft도 이를 명시했으나, 향후 혼동 방지를 위한 코드 주석(JSDoc, migration comment) 추가 권고가 있으면 좋다.
- **제안**: Draft 내에 "컬럼명 불변 유지 + 코드 JSDoc으로 'chat kind FK' 명시 예정" 1줄 추가 (선택).

---

## 요약

본 target 문서(`plan/in-progress/spec-draft-unified-model-management.md`)는 **CRITICAL 위반 1건**이 존재한다: `plan/in-progress` 최상위 파일에 필수인 `worktree`·`started`·`owner` frontmatter가 전혀 없어 `plan-frontmatter.test.ts` build guard 위반이 확실하다. 동일 유형 spec-draft 파일들(`spec-draft-rag-dynamic-cut.md`, `spec-draft-conventions-code-data.md`)이 모두 frontmatter를 정상 보유하고 있는 것과 대조된다. WARNING 2건은 마이그레이션 번호 고정 기술로 인한 구현 시 race 유발 위험과 `set-default` 동사형 경로 패턴 검토 권고이며, INFO 2건은 minor 일관성 제안이다. CRITICAL 건은 spec 변경 착수 전 반드시 수정해야 하며, WARNING 건은 구현 PR 착수 전 검토가 권장된다.

## 위험도

**HIGH**
