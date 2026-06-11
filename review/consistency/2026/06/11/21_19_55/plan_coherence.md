# Plan 정합성 검토 결과

대상: `spec/4-nodes/5-data/2-code.md` (spec draft — `--spec` 모드)
검토일: 2026-06-11

---

## 발견사항

### [WARNING] refactor/04-security.md C-2 "결정 대기" 항목을 target spec 이 일방 종결
- **target 위치**: `spec/4-nodes/5-data/2-code.md` §7.1 + `## Rationale` "격리 방식 `isolated-vm` 전환 — 위협 모델과 결정 (2026-06-11)"
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/04-security.md` §C-2 체크박스 `- [ ] 결정 대기 (사용자)` + README.md 의 ⚠️ 항목 표 `04 C-2` 행
- **상세**: `refactor/04-security.md` C-2 는 `- [ ] 결정 대기 (사용자)` 상태이고, README.md 의 "⚠️ 의도된 설계지만 문제" 표는 `04 C-2 vm 탈출` 을 **사용자 결정 없이 착수 금지** 대상으로 명시한다. target spec 의 `## Rationale` 은 "사용자 결정(2026-06-11)으로 spec 로드맵이 지정했던 `isolated-vm`(V8 Isolate) 으로 전환한다" 및 "구 §7.1 '선택 근거' 가 '추후 재검토' 로 남겨둔 로드맵 항목을 본 결정으로 **종결**한다" 고 선언하고 있다. 또한 spec §7.1 본문은 현재 구현을 `isolated-vm` 으로 기술하며 `node:vm` 은 구 §7.1 `Rationale §Rationale` 로 이관됐다. 즉 C-2 의 `isolated-vm` 선택 결정이 spec 에 이미 반영됐으나, plan 의 체크박스(`- [ ] 결정 대기`)와 README 의 "사용자 결정 없이 착수 금지" 표기가 갱신되지 않아 plan↔spec 이 불일치한다.
- **제안**: `refactor/04-security.md` C-2 체크박스를 `- [x] ✅ 사용자 결정 완료 (2026-06-11, isolated-vm 전환 확정 — spec §7.1 Rationale 참조)` 로 갱신하고, README.md 의 `04 C-2` 행을 ✅ 로 마킹. M-2 (`- [ ] 결정 대기`) 도 "C-2 에 흡수 확정" 으로 갱신 필요. `project-planner` 수행.

---

### [WARNING] node-output-redesign/code.md 의 "로드맵 미구현" 서술이 target spec 과 충돌
- **target 위치**: `spec/4-nodes/5-data/2-code.md` §5.3.3 메모리 초과 케이스, §7.2 리소스 제한, §7.1 격리 방식
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/node-output-redesign/code.md` §구현 분석 §8 "로드맵 (`isolated-vm` 또는 컨테이너): spec §7.1 표가 명시 — 메모리 하드 리밋(128MB) 필요 시 전환. **현재 미구현은 의도된 트레이드오프**" + `CODE_MEMORY_LIMIT /* 로드맵 */` 주석 + "메모리 초과는 spec §5.3 footnote 에 `CODE_MEMORY_LIMIT` 로드맵 — 현재 `node:vm` 한계로 미구현."
- **상세**: `node-output-redesign/code.md` (2026-05-16 작성)는 `CODE_MEMORY_LIMIT` 를 "로드맵 미구현" 으로 기술하고 있다. 그러나 target spec 은 §5.3.3 에 메모리 초과 케이스를 정식 케이스로 포함하고, §7.1·§7.2 는 `isolated-vm` 을 **현재 구현**으로 기술하며 `memoryLimit: 128` 을 명시한다. `node-output-redesign/code.md` 의 분석이 미구현 기준으로 쓰여진 상태라 target spec 과 불일치하는 서술이 그대로 남아있다. 이 plan 이 향후 참조될 경우 혼란 유발 가능.
- **제안**: `node-output-redesign/code.md` 의 §구현 분석 §8 해당 로드맵 서술("현재 미구현", `/* 로드맵 */` 주석 등)을 "2026-06-11 전환 완료" 로 최신화하거나, 본 plan 의 분석이 과거 시점 기준임을 명시. `developer` 또는 `project-planner` 수행.

---

### [INFO] refactor/04-security.md M-2 ("Promise 생성자 노출 — C-2 에 흡수") plan 갱신 누락
- **target 위치**: `spec/4-nodes/5-data/2-code.md` §4.1 "비동기 코드 지원: async/await / Promise 모두 사용 가능", §7.3 허용 표에 `Promise` 명시
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/refactor/04-security.md` §M-2 `- [ ] 결정 대기 (사용자)`, 개선 방안 "C-2 의 isolated-vm/컨테이너 전환에 흡수 — 본 항목 단독 처리 금지"
- **상세**: M-2 는 "C-2 결정·구현 완료까지 본 항목 미해결 상태 지속" 을 명시하며, C-2 전환(isolated-vm)이 Promise 탈출면을 격리 계층에서 흡수한다. target spec 이 isolated-vm 을 현재 구현으로 명시했으므로 M-2 는 사실상 해소됐으나 체크박스가 여전히 `[ ]` 다.
- **제안**: `refactor/04-security.md` M-2 를 `- [x] ✅ C-2 isolated-vm 전환 시 흡수 완료 (2026-06-11)` 로 갱신. `project-planner` 수행.

---

### [INFO] marketplace-and-plugin-sdk.md 의 샌드박싱 로드맵 참조가 구 spec 기준
- **target 위치**: `spec/4-nodes/5-data/2-code.md` §7.1 로드맵 "(선택): 컨테이너 / gVisor"
- **관련 plan**: `/Volumes/project/private/clemvion/plan/in-progress/marketplace-and-plugin-sdk.md` "샌드박싱 — 외부 노드 실행 시 isolated-vm / Docker 격리 (spec `5-data/2-code.md` §로드맵에 isolated-vm 언급)"
- **상세**: `marketplace-and-plugin-sdk.md` 는 isolated-vm 을 "로드맵" 으로 참조하는데, target spec 은 이제 isolated-vm 을 현재 구현으로 기술하고 컨테이너/gVisor 를 로드맵 후속으로 남긴다. cross-reference 의 섹션 앵커와 표현이 구식이 됐다. 단 이 plan 은 별도 샌드박싱 설계를 다루며 target spec 의 변경이 직접 착수를 차단하지는 않는다 — 표현 정확도 문제.
- **제안**: `marketplace-and-plugin-sdk.md` 의 해당 라인을 "외부 노드 실행 시 컨테이너 / gVisor 격리 — code 노드는 isolated-vm 기전환(§7.1), 마켓플레이스 외부 노드는 별도 sandbox 설계 필요" 로 업데이트. `project-planner` 또는 `developer` 수행 (착수 비차단).

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검토 결과:

1. `code-node-isolated-vm` (branch `claude/code-node-isolated-vm`) — Step 1 ancestor 검사: `git merge-base --is-ancestor` 결과 **STALE** (branch HEAD 가 main 의 조상). Step 2 미실행 (Step 1 이 stale 확정). 현재 이 worktree 는 본 검토가 실행 중인 위치이나 branch 자체는 main 에 이미 포함됨 — 그 자체가 worktree 충돌 대상 아님.

2. `audit-coverage-naming` (branch `claude/auth-config-audit`) — Step 1 ancestor 검사: **STALE**. Step 2: `gh pr list --state all --head claude/auth-config-audit` 결과 **빈 배열** (PR 없음). Step 3 cascade: PR 미발행 stale 브랜치. spec 파일(`spec/4-nodes/5-data/2-code.md`) 비접촉 확인 (git diff 출력 없음) — skip.

3. `prod-fail-closed-guards` (branch `claude/prod-fail-closed-guards`) — Step 1: ACTIVE (미포함). Step 2: PR #539 상태 **MERGED** → **stale**. spec 파일 비접촉 (`spec/5-system/1-auth.md` 등만 변경) — skip. 정리되지 않은 worktree 잔류 (review/** 전용 commit 만 있음).

- `audit-coverage-naming` — Step 1 ancestor STALE, Step 2 PR 없음 → stale. 활성 이유 없으면 `./cleanup-worktree-all.sh --yes --force` 권장.
- `prod-fail-closed-guards` — Step 2 PR #539 MERGED → stale. 동일하게 cleanup 권장.

---

## 요약

target `spec/4-nodes/5-data/2-code.md` 는 2026-06-11 사용자 결정에 따라 `isolated-vm` 전환을 spec 에 공식화한 문서다. Plan 정합성 관점에서 주된 문제는 `refactor/04-security.md` 의 C-2 항목이 여전히 `- [ ] 결정 대기 (사용자)` 로 남아있어 plan↔spec 불일치를 야기한다는 것이다 (WARNING). `node-output-redesign/code.md` 의 "로드맵 미구현" 서술도 target spec 과 충돌한다 (WARNING). M-2(Promise 흡수) 체크박스 미갱신과 `marketplace-and-plugin-sdk.md` 의 구식 로드맵 참조는 INFO 수준이다. worktree 충돌 후보 7건 중 stale 3건(`code-node-isolated-vm` self, `audit-coverage-naming`, `prod-fail-closed-guards`)을 skip, active worktree 4건(`ai-node-override-fields`, `auth-refresh-rotation-atomic`, `fix-model-configs-kind-400-88c8b4`, `unified-model-mgmt-5af7ee`)은 모두 `spec/4-nodes/5-data/2-code.md` 를 비접촉으로 확인 — 동시 편집 경합 없음.

---

## 위험도

MEDIUM

STATUS: SUCCESS
