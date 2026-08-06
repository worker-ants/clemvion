# 신규 식별자 충돌 검토 — naming_collision

## 사전 검증 (impl-done 스코프 확인)

본 검토 요청은 `--impl-done, scope=spec/conventions, diff-base=origin/main` 로 지정되어 있어,
분석에 앞서 지정된 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379`)를
**절대경로**로 지목해 실제 diff 존재 여부를 먼저 확인했다.

```
git -C <worktree> diff --stat origin/main -- spec/conventions/ spec/0-overview.md \
  plan/in-progress/ai-agent-tool-connection-rewrite.md
```
→ 출력 없음 (변경 파일 0개).

추가로 target payload 에 번들된 `spec/conventions/audit-actions.md` 전문을 워킹트리의 실제
파일과 바이트 단위로 diff 했으나 **완전히 동일**했다. 즉 이번 target payload 에 포함된 6개 문서
(`audit-actions.md`, `cafe24-api-catalog/_overview.md`·`category.md`·`store.md`·`translation.md`,
`cafe24-api-metadata.md`, `chat-channel-adapter.md`, `spec/0-overview.md`,
`plan/in-progress/ai-agent-tool-connection-rewrite.md`)는 **diff-base(`origin/main`) 대비 변경분이
전혀 없는, 이미 여러 주 전에 병합된 기존 conventions/spec 내용**이다 (각 파일 최종 커밋: `d4b774f10`
2026-07-07, `c234dcc6b` 2026-06-27, `734864d4b` 2026-07-16, `29aa918a6` 2026-07-17,
`f8c334947` 2026-07-17 — 전부 이번 작업(harness CI backstop, `HEAD=6384514b2`)보다 훨씬 이전).

실제로 이번 브랜치가 `origin/main` 대비 도입한 diff는 harness/CI 백스톱 관련 파일뿐이다
(`.github/workflows/harness-checks.yml`, `.claude/tests/test_packages_prepare_contract.py`,
`codebase/packages/*/package.json` 등) — `spec/**`, `plan/**` 는 전혀 포함되지 않는다.

**결론**: 이번 target 은 "새로 도입"하는 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV
var·파일 경로가 **하나도 없다**. 번들된 내용 전체가 이전에 이미 검토·병합된 기존 정의다. 따라서
본 checker 의 관점(신규 식별자 vs 기존 사용처 충돌)은 이번 target 에 적용할 대상이 존재하지 않는다.

이는 memory 에 기록된 기존 harness 결함 패턴(impl-done spec 번들이 실제 diff 범위와 무관하게
scope 디렉토리 전체를 컨텍스트로 번들링할 수 있음 — "impl_done_spec_bundle_bug")과 부합한다.
prompt 재조립·grep 0건 시의 정책과 동일하게, 이 경우는 **BYPASS 근거로 기록**하고 가공의 충돌을
만들어 보고하지 않는다.

## 참고: due-diligence 스킴

위 결론에도 불구하고 번들 내용을 훑어 이미 알려진 명명 충돌 패턴이 재발했는지 확인했다 (신규
diff 가 아니므로 CRITICAL/WARNING 대상은 아니고 순수 참고용):

- `cafe24-api-catalog/_overview.md` §5 각주에 이미 자체 인지된 잠재 이슈가 기록돼 있다 — `store.md`
  의 `privacy_*` id 명명이 별도 `privacy` resource 와 prefix 충돌 우려가 있다는 내용이 "별 트랙으로
  follow-up 가능"으로 이미 문서화돼 있음. 이는 기존 코드베이스에 존재하는 기지(既知) 사항이며
  이번 target 이 새로 만든 충돌이 아니다.
- `chat-channel-adapter.md` §Rationale 은 "Cafe24 request envelope" 라는 용어가 CONVENTIONS
  Principle 7 의 "노드 출력 envelope"(`{config, output, meta, port}`) 와 이름이 겹칠 수 있음을
  스스로 명시적으로 구분(용어 주의 각주)해 두었다 — 이미 해소된 잠재 혼동이다.
- `audit-actions.md` 의 액션 레지스트리·`ChatChannelAdapter` 인터페이스·`EiaEvent`/
  `ChatChannelInternalEvent` 타입 등은 모두 각 문서의 `## Rationale`(R1~R-CCA-8, 3분류 근거 등)에서
  이미 근거·기각 대안이 기록된 기존 합의 사항이다. 신규 도입 흔적이 없다.

이 스킴 범위에서 새로 보고할 CRITICAL/WARNING 은 없다.

## 발견사항

없음 — 신규 diff 부재로 신규 식별자 충돌 분석 대상 자체가 없음.

## 요약

target payload 가 `--impl-done, scope=spec/conventions, diff-base=origin/main` 로 지정했으나,
지정된 워킹트리에서 `git diff --stat origin/main -- spec/conventions/ spec/0-overview.md
plan/in-progress/ai-agent-tool-connection-rewrite.md` 를 절대경로로 직접 실행한 결과 변경 파일이
0개였고, 번들된 `audit-actions.md` 전문도 워킹트리 파일과 바이트 단위로 동일했다. 즉 이번
target 은 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·ENV var·파일 경로 중 어느 것도 새로
도입하지 않았다 — 번들된 6개 문서 전부 수 주 전에 이미 병합된 기존 conventions/spec 내용이며,
이번 브랜치(harness CI backstop)의 실제 diff 는 `.github/workflows/`·`.claude/tests/`·
`codebase/packages/*/package.json` 등 harness/패키지 영역에 한정되고 `spec/**`·`plan/**` 를
포함하지 않는다. 따라서 "신규 식별자 충돌" 관점에서 보고할 발견사항이 없으며, 이는 known
harness 결함 패턴(impl-done 번들이 diff 범위와 무관하게 scope 전체를 컨텍스트로 포함)에 해당하는
것으로 판단해 BYPASS 로 기록한다. Due-diligence 스킴에서도 추가 CRITICAL/WARNING 은 발견되지
않았다(기존에 이미 문서 내에서 자체 인지·해소된 잠재 혼동만 확인).

## 위험도

NONE
