# 공유 테스트 픽스처

여러 스택(백엔드 · 에디터 · 웹채팅 위젯)이 같은 규칙을 각자 구현할 때 그 테스트들이 함께 읽는 기대값이다.
규칙을 한쪽만 고치면 다른 쪽 테스트가 실패해서 구현이 어긋난 채로 머지되지 않는다.

이 폴더는 테스트만 읽는다. 앱 코드가 import 하지 않고 빌드 산출물에도 들어가지 않는다.
워크스페이스 패키지가 아니라서 `pnpm-workspace.yaml` · Dockerfile 에 등록하지 않는다.

## 파일

| 파일 | 규칙 | 읽는 테스트 |
| --- | --- | --- |
| `chart/colors.json` | 차트 `colors` 허용 형식(CLE-NODE-CHART REQ-CHART-020). `accepted` 는 그대로 남고, `trimmed` 는 앞뒤 공백을 지운 값이 남고, `rejected` 는 버려지는 값이다 | `codebase/frontend/src/components/editor/run-results/__tests__/chart-series.test.ts`, `codebase/channel-web-chat/src/lib/presentation.test.ts` |
| `chart/series.json` | 다중 시리즈 묶음(CLE-NODE-CHART 「시리즈와 색」 · 실행 로직 2 · 3단계). `render` 는 렌더러가 그리는 모양, `sum` 은 백엔드가 `groupBy` · `sum` 으로 집계한 결과다 | 위 에디터 테스트, `codebase/channel-web-chat/src/lib/chart-model.test.ts`, `codebase/backend/src/nodes/presentation/chart/chart.handler.spec.ts` |

웹채팅 위젯 테스트는 `codebase/channel-web-chat/src/test-support/chart-fixtures.ts` 를 거쳐 읽는다.

## 고칠 때

- 규칙을 바꾸면 픽스처를 먼저 고치고 세 스택 테스트를 모두 돌린다. 한 스택만 통과하면 나머지 구현을 맞춘다.
- 새 파일을 더하면 위 표와 그 파일을 읽는 스택의 CI 경로 필터(`.github/workflows/{backend,frontend,web-chat}-checks.yml` 의 `pathspecs`)를 함께 고친다. 픽스처만 바꾼 PR 에서도 대조가 돌게 하기 위해서다.
- 각 JSON 의 `$comment` 가 필드 뜻을 설명한다. 테스트는 `$comment` 를 읽지 않는다.
