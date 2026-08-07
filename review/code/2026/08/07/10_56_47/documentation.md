# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 오버라이드 블록의 CVE 근거 추적용 커밋 해시가 존재하지 않는 커밋을 가리킨다 (pre-existing, 이번 diff 가 그 블록의 항목을 수정하며 재노출)
  - 위치: `pnpm-workspace.yaml:24` (전체 파일 컨텍스트 게이트) — `# audit 커밋(b2bbb49e) 참조.`
  - 상세: 이 주석은 `overrides` 블록 전체("각 CVE 사유는 audit 커밋(b2bbb49e) 참조")의 근거 추적 창구인데, `b2bbb49e` 는 로컬(`git rev-list --all`, `git fsck --unreachable` 포함) 어디에도 존재하지 않는 해시다. `git log -S "audit 커밋"` 으로 최초 도입 지점을 추적하면 npm→pnpm 전환 커밋(`4dfd59e8c`, #646)까지 거슬러 올라가고, 그 이후 `#947`(`ef3617a79`)에서도 문구만 옮겨졌을 뿐 해시는 갱신되지 않았다 — 즉 이번 diff 이전부터 죽어 있던 참조다. 다만 이번 PR 은 바로 이 블록이 관리하는 `fast-uri`·`hono`·`js-yaml`·`undici` 항목의 값을 실제로 바꾸므로, 독자가 "이 상향의 CVE 근거가 뭐였나"를 이 주석을 따라 재구성하려 하면 막힌다. `check-pnpm-security-config.py` 는 값의 **동일성**(2-place 편집)만 검증하고 이 서술형 참조의 유효성은 검증하지 않아 코드로 잡히지 않는다.
  - 제안: `b2bbb49e` 를 실제 커밋(예: 이번 diff 의 근거를 담은 `c8ad8de6b`, 혹은 각 항목별 최신 근거 커밋)으로 교체하거나, "audit 커밋" 단일 포인터 대신 커밋 메시지에 이미 있는 실측표(패키지·구버전·필요버전·경로) 방식으로 주석을 갱신해 근거를 자체 완결시킨다.

## 요약

이번 변경은 순수 의존성/락파일 갱신(`fast-uri`·`hono`·`js-yaml`·`undici`·`socket.io-parser` 등 override 바닥 상향 + `undici` 직접 의존 상향)이며, 공개 API·함수 시그니처·환경변수 변경은 없어 독스트링/README/API 문서/예제 코드 항목은 해당 사항이 없다. `pnpm-workspace.yaml` 에 새로 추가된 `socket.io-parser: ~4.2.7` 오버라이드 주석은 `^` 대신 `~` 를 쓴 이유를 GHSA ID·상위 패키지의 실제 요구 범위(`socket.io@4.8.3` → `socket.io-parser: ~4.2.4`, `node_modules` 로 직접 검증됨)까지 명시해 모범적이다. `check-pnpm-security-config.py` 의 `EXPECTED_OVERRIDES` 도 `pnpm-workspace.yaml` 과 정확히 동기화되어 있어 그 파일 docstring 이 요구하는 "2-place 편집" 규약이 실제로 지켜졌다. 이 클래스의 선행 커밋들(#1034/#1036/#1038/#1043/#1088) 모두 `CHANGELOG.md` 를 건드리지 않은 전례가 확인되어, 이번 커밋의 CHANGELOG 미기재는 저장소 관례에 부합하며 결함이 아니다. 유일한 흠은 사전에 이미 죽어 있던 `pnpm-workspace.yaml` 의 커밋 해시 참조(`b2bbb49e`)이며, 이번 diff 가 바로 그 참조가 관장하는 항목들을 건드리므로 근거 추적이 끊긴 상태가 실질적으로 노출된다.

## 위험도
LOW
