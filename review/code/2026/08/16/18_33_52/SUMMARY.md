# Code Review 통합 보고서 (5라운드 — 코드 동결 후)

## 전체 위험도

**LOW** — **CRITICAL 0 · WARNING 4**. forced 7명 전원 결과 확보, skip 0.

> `security` reviewer 의 `output_file` 이 디스크에 남지 않아 main 이 반환 전문으로 재영속화했다
> (worktree sub-agent write 격리 — 이번엔 프롬프트에 "반환 메시지에도 전문 포함" 을 명시해
> 손실 없이 복원됐다). `testing` reviewer 에게는 **`git checkout`/`git restore` 금지**를
> 명시했고, 실제로 읽기 전용으로만 수행해 트리를 건드리지 않았다 — 직전 라운드에서 그 명령이
> 내 미커밋 작업을 지울 뻔했기 때문이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 조치 |
|---|---|---|---|
| 1 | maintainability | 테스트 헬퍼 `buildSingleQB` 가 같은 파일에 **완전 중복 정의** — 내 신규 describe 가 기존 정의를 복붙했다 | **수정** — 최상위 describe 로 hoist, 하나만 남김 |
| 2 | maintainability | **리뷰 라운드 이력이 영구 소스 주석에 박제** — `"종전 이 문장은 … 틀렸다(18_14_50 documentation W1)"` 류. 함수 본문 3줄에 JSDoc 30줄 | **수정** — 라운드 ID·자기정정 서사 제거, 설계 근거만 남김. 서사는 커밋·CHANGELOG·plan 이 담는다 |
| 3 | documentation | CHANGELOG 신규 항목의 *"위 항목"* 이 실제로는 **아래**를 가리킴 (최신이 위로 쌓이는 관례 탓) | **수정** — `#1177`(아래 항목) 로 직접 지칭 |
| 4 | requirement / documentation | `plan-lifecycle.md` 의 `pending_plans` 실측치가 stale 하다는 지적 | **아래 별항 — 내 수치가 맞았다** |

### #4 — 두 리뷰어가 서로 다른 값을 제시했고, 실측하니 내 수치가 옳다

`requirement` 는 *"plan 레벨 5건"*, `documentation` 은 *"spec 18 · plan 5"* 라고 했다.
**둘이 서로 다르다는 것 자체가 방법론 신호**라 직접 판정했다 — 두 리뷰어 모두
`grep -rl '^pending_plans:'` 로 **파일 전체**를 훑었고, 그건 **본문 코드블록의 예시까지 센다**:

- `spec/conventions/spec-impl-evidence.md` — `pending_plans:` 가 **스키마 예시**(그 문서가
  설명하는 frontmatter 템플릿) 2곳
- `plan/complete/spec-draft-web-chat-console.md:158` — **펜스 코드블록** 안의 *제안된* spec frontmatter

내 스크립트는 각 파일의 **frontmatter 블록만 파싱**하므로 이들을 세지 않는다 → **17 · 4 가 맞다.**

**다만 지적의 뿌리는 옳다**: 하드코딩된 수치가 이런 분쟁을 부른다. 그래서 수치를 고치는 대신
**세는 방법을 문서에 박았다** — "frontmatter 파싱 기준", "`grep` 으로 세면 예시까지 잡혀 과다
계상된다"(오탐 파일 2곳을 이름으로 지목), "스냅샷이라 시간이 지나면 어긋나는 것이 정상".

## 참고 (INFO) — 조치 불요

- **security(NONE)** — 5라운드 연속 *"신규 취약점 아님, 기존 CWE-209 계열을 닫는 방어적 수정"*.
  마스킹 5개 지점을 소스로 직접 열어 재확인했고, IDOR 가드·파라미터 바인딩·e2e 백도어
  이중 게이트가 리팩터로 훼손되지 않았음까지 검증.
- **testing(NONE) · side_effect(NONE) · scope(LOW)** — 각각 `⑤-c` 뮤테이션 검증 재확인,
  `stopInternal` "return 문 셋" 서술 재검산, 되돌린 `explore-tools` 변경이 최종 diff 에
  **흔적 없이 제거**됐음 확인.
- **maintainability INFO** — `ResponseExecution` 네이밍 방향이 `*ResponseDto` 관례와 반대라는
  지적. DTO 클래스가 아니라 서비스 내부 반환 타입이고 JSDoc 이 그 구분을 명시하므로 유지.

## 조치 결과

[`RESOLUTION.md`](./RESOLUTION.md) 참조.
