# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 새로 선언된 4개 devDependencies 에 "왜 필요한가"를 코드 근처에 남기는 앵커가 없다
  - 위치: `codebase/frontend/package.json:79, 88, 91, 92` (`@types/mdast`, `github-slugger`, `mdast-util-from-markdown`, `mdast-util-to-string`)
  - 상세: 이 4개 패키지는 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 가 이미 import 하고 있었으나 어느 매니페스트에도 선언되지 않았던 결함(워크트리 중첩이 `node-linker=isolated` 를 무력화해 로컬에서만 조용히 해소됨)의 수정이다. 커밋 메시지와 `plan/in-progress/harness-review-gate-ci-backstop.md` 부록에는 그 경위가 상세히 기록돼 있지만, `package.json` 자체에는 이 devDependencies 가 (앱 코드가 아니라) 테스트 전용 가드가 쓴다는 단서가 없다. 이 저장소는 이미 같은 파일 상단에 `"//pin"` 키로 버전 정책 근거를 남기는 관례가 있으므로, 유사 패턴을 적용할 여지가 있다. 이 저장소에 knip/depcheck 류의 자동 "미사용 의존성" 제거 도구는 없어(확인함) 즉각적인 회귀 위험은 낮지만, 사람이 수동으로 "안 쓰는 것 같다"고 판단해 제거하면 diagnosing 에 상당한 시간이 들었던 CI-only 결함이 재발할 수 있다.
  - 제안: 필수는 아님. 원한다면 `"//pin"` 옆에 `"//devDeps"` 류의 키로 "spec-links.ts 가 쓰는 mdast/github-slugger 계열 — 앱 코드에서 직접 import 하지 않아도 지우지 말 것" 한 줄을 남기면 향후 오삭제를 예방한다.

- **[INFO]** 부록 표의 항목 5·7 이 다른 항목과 달리 추적 가능한 이슈/PR 번호가 없다
  - 위치: `plan/in-progress/harness-review-gate-ci-backstop.md:469` (항목 5, `PR 진행 중`), `:471` (항목 7, `미처분`)
  - 상세: 같은 표의 항목 1~4 는 `#1091 종결` 형태로 참조 가능한 이슈 번호를 달고 있고, 항목 6 은 `본 PR`(자기 참조라 명확)이다. 반면 항목 5(`prepare` 가 디렉터리 존재만 봐 stale dist 미재빌드)와 항목 7(`check-override-floors.py` exit 1)은 상태만 서술하고 어떤 PR/브랜치가 그것을 다루는지 참조가 없다. 실제로 항목 5 는 이 리뷰 시점에 별도 브랜치(`claude/packages-prepare-stale-dist`, 커밋 `1ac458d07`)에서 이미 처리되고 있었는데, 이 문서만 보면 그 사실을 알 수 없다. 이 티켓 문서가 향후 참조점이 될 것이므로, 병렬 작업이 머지된 뒤 이 표가 stale 로 남을 위험이 있다(항목 5 상태 갱신 누락).
  - 제안: 필수는 아님. 항목 5·7 에도 PR 번호나 브랜치명을 채워 넣거나, 최소한 이 표를 다시 열어볼 때 상태를 재확인하라는 메모를 부록 서두에 남기면 추적성이 좋아진다.

## 요약

이번 diff 는 `codebase/frontend/package.json` 에 이전부터 암묵적으로 (워크트리 중첩으로 인한 `node_modules` 상위 탐색 우연) 해소되던 4개 devDependencies(`@types/mdast`, `github-slugger`, `mdast-util-from-markdown`, `mdast-util-to-string`)를 명시 선언하고, `pnpm-lock.yaml` 을 그에 맞춰 재생성했으며, `plan/in-progress/harness-review-gate-ci-backstop.md` 에 CI 활성화 후 드러난 기존 결함 7건을 표와 근거 서술로 정리한 부록을 추가한 것이다. 커밋 메시지 자체가 원인(`node-linker=isolated` 가 중첩 워크트리에서 무력화됨)·재현 증거(로컬 13 tests 통과 vs CI 실패)·검증(해소 경로 이동 확인, lockfile churn 264줄 중 버전 변화 4개뿐임을 실측)을 매우 꼼꼼히 기록했고, plan 부록도 같은 내용을 표+서사로 중복 없이 잘 갈무리했다. `spec-links.ts` 자체 헤더 주석도 이미 SoT 링크와 알고리즘 근거를 담고 있어 코드-문서 정합성에 문제가 없다. 발견된 2건은 모두 INFO 수준의 개선 여지(오삭제 방지용 인라인 주석, 부록 표의 추적 번호 부재)이며 어느 것도 정정 없이 병합해도 실해를 유발하지 않는다.

## 위험도
NONE
