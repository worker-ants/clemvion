# Plan 정합성 검토 결과

- 검토 모드: `--impl-prep`
- 대상 문서: `spec/2-navigation/6-config.md`
- 검토 기준일: 2026-06-27

---

## 발견사항

### [WARNING] `refactor/02-architecture.md` C-2 cluster 4 "PR 대기" 상태가 stale — PRs 이미 머지됨

- target 위치: `spec/2-navigation/6-config.md` frontmatter `code:` + §3 Model Config API + Rationale R-7
- 관련 plan: `plan/in-progress/refactor/02-architecture.md` §C-2 cluster 4 (llm↔model-config)
- 상세: 해당 plan 항목은 `[~] 진행 중 — ... 4(llm↔model-config) 완료 — ..., PR 대기 (branch claude/refactor-02-c2-llm-modelconfig-93cae7)` 로 기술돼 있다. 그러나 실제로는 다음 두 PR이 `origin/main` 에 이미 반영돼 있다:
  - `000d8963` PR #714: C-2 cluster 4 코드 변경 (forwardRef 제거, `LlmModelConfigController` 신설, `llm-model-config.controller.ts` spec frontmatter 등재)
  - `3e102ed3` PR #716: `testConnection` Editor+ 게이트 구현 + spec R-7 Rationale 신설
  따라서 현재 `mc-endpoint-hardening-dca699` 가 체크아웃 중인 `origin/main` 에는 이미 C-2 cluster 4 의 모든 코드 변경과 spec 갱신이 반영된 상태다. plan 문서의 "PR 대기" 표기는 `origin/main` 의 실제 상태와 불일치한다.
  또한 `refactor-02-c2-llm-modelconfig-93cae7` 브랜치에는 7개 커밋이 아직 main 에 없는 상태이며, 그 중 `10526ad9` (spec-sync) 은 #714 이 이미 main 에 적용한 것과 동일한 `llm-model-config.controller.ts` 추가를 중복으로 포함한다. 해당 브랜치가 그대로 머지되면 no-op 이지만 이력 혼란이 생긴다.
- 제안: `plan/in-progress/refactor/02-architecture.md` C-2 cluster 4 항목을 "✅ 완료 (PR #714·#716 머지됨)" 로 갱신하고, 02-architecture.md 전체 완료 여부를 점검해 `plan/complete/` 이동을 검토한다. `refactor-02-c2-llm-modelconfig-93cae7` 브랜치 잔여 docs/review 커밋은 머지 또는 스킵 결정 필요.

---

### [INFO] `auth_config.create/update/delete/regenerate` audit 기록 "Planned" — target spec 미반영

- target 위치: `spec/2-navigation/6-config.md` §A.4 권한 / §3 Authentication API
- 관련 plan: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` §G-01 감사 로그 Planned 항목
- 상세: cross-audit plan 의 G-01 경과 기록은 `auth_config.reveal` 만 구현됨, `auth_config.create/update/delete/regenerate` 는 `spec/5-system/1-auth.md §4.1` 에서 **Planned** 상태임을 명시한다. 이 Planned 항목은 `spec/2-navigation/6-config.md` §3 Authentication API 표나 §A.4 권한 절에 직접 언급되지 않으며, SoT 는 `1-auth.md §4.1` 이다. target spec 자체에는 갭이 없다.
- 제안: 구현 시 `6-config.md` 의 Auth Config mutation 엔드포인트(`POST /api/auth-configs`, `PATCH :id`, `POST :id/regenerate`, `DELETE :id`)에 `@Roles('admin')` 가드 외에 `AuditLogsService.record` 호출이 없는지 코드에서 확인한다. 해당 audit 기록은 별도 plan 으로 이관된 사안이며 본 `--impl-prep` 대상 범위는 아니다.

---

### [INFO] `spec-sync-structural-followups.md` — 6-config 관련 항목 부재 확인

- target 위치: `spec/2-navigation/6-config.md` 전체
- 관련 plan: `plan/in-progress/spec-sync-structural-followups.md`
- 상세: 구조적 spec 동기화 followup plan 을 확인한 결과 `spec/2-navigation/6-config.md` 에 직접 영향을 주는 미결 항목이 없다. Auth Config / Model Config 관련 갭들은 별도 plan(`spec-sync-auth-gaps.md` — LDAP/SAML 전용, 본 target 무관)으로 이미 분리돼 있다.
- 제안: 해당 없음.

---

## 요약

`spec/2-navigation/6-config.md` 와 관련 in-progress plan 들 사이에 **미해결 결정 우회(CRITICAL)는 존재하지 않는다.** Auth Config(Admin+ CRUD) 및 Model Config(Editor+ CRUD, action-POST Editor+, GET Viewer+) 권한 결정은 이미 spec 에 확정·명문화돼 있으며, 어떤 in-progress plan 도 이 결정을 "TBD" 로 남겨둔 채 다른 방향으로 일방 결정하고 있지 않다. 단 `refactor/02-architecture.md` C-2 cluster 4 항목이 "PR 대기"로 표기돼 있으나 해당 PRs(#714·#716)는 이미 `origin/main` 에 반영된 stale 상태임이 WARNING 으로 확인됐다. 이는 구현자가 이 plan 항목을 아직 미완료로 오인할 수 있어 plan 문서 갱신이 필요하다. 선행 조건 미해소나 후속 항목 누락은 발견되지 않았다.

## 위험도

LOW

---

STATUS: SUCCESS
