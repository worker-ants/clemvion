# RESOLUTION — 15_46_17 (타겟 수렴 라운드)

**Critical 0 · WARNING 1 · INFO 4 · risk LOW.** `REVIEW_AGENTS=requirement,maintainability,testing`
타겟 실행(3/3 success) — 3차 WARNING 을 낸 바로 그 세 reviewer 다.

**이 라운드의 changeset 에는 애플리케이션 코드가 없다** — 3차 fix 가 이미 검토된 코드라
diff 가 consistency 산출물 6건만 담았다(reviewer 자신이 그렇게 적었다). 이 저장소가
"리뷰 changeset 이 직전 검토 코드를 제외한다" 로 기록해 둔 그 형태이고, **수렴 판정 지점**이다:
발견이 코드에서 완전히 떠나 생성 산출물의 형식으로 옮겨 갔다.

## 조치 항목

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| W1 | 형식 일관성 | `review/consistency/…/15_09_04/naming_collision.md` 가 sub-agent 반환 규약의 raw 헤더(`STATUS=…` + `===REPORT_MARKDOWN_BELOW===`)를 **영속 파일 본문에 그대로** 남겨, 같은 세션의 다른 4개 리포트(전부 `#` 제목 시작)와 형식이 어긋났다. 다운스트림 게이트 파싱에는 영향 없음이 확인됐으나, 첫 줄을 제목으로 가정하는 파서나 사람이 볼 때 깨진다 | **수정.** 마커 이전을 제거해 `#` 제목부터 시작하게 했다 |
| INFO 1 | 형식 일관성 | 같은 파일의 `## 위험도` 가 형제 파일과 다른 줄바꿈(헤딩 바로 다음 줄에 값) | **수정.** 빈 줄 삽입으로 통일(W1 과 같은 자리라 함께) |
| INFO 3 | 검증 갭 | `cross_spec.md` 가 스스로 "`system-status.e2e-spec.ts` 는 **파일명만** 대조했고 nil UUID 프로브 assertion 내용은 미검증" 이라고 캐버트를 달았다. `isUuidShaped` 도입 근거가 그 assertion 의 실재에 기댄다 | **확인 완료 — 실재한다.** `codebase/backend/test/system-status.e2e-spec.ts:147` 이 `.set('X-Workspace-Id', '00000000-0000-0000-0000-000000000000')` 로 nil UUID 를 타 워크스페이스 프로브로 쓰고 200 을 단언한다. 즉 `isValidUuid`(nil 거부)를 썼다면 그 e2e 가 깨졌을 것이라는 근거가 실측으로 선다 |

> **근본 원인은 harness 쪽**이다 — 이 checker 의 저장 경로만 raw stdout 을 그대로 write
> 하는 것으로 보인다. 이 PR 은 산출물 1건을 정정할 뿐이고, 반복되면 harness 트랙에서
> 볼 항목이다(reviewer 도 같은 권고).

### 미조치 (INFO 2건)

- **INFO 2** — 자동 생성 리포트의 "상세" 가 초장문 단락. 생성기 스타일 문제라 이 PR 에서
  손댈 자리가 아니다.
- **INFO 4** — `.spec.ts` 들에 동명 fixture 상수(`OTHER_WS`)가 다른 값으로 존재.
  reviewer 도 "plan §후속 fixture 공용화가 채택되면 자연 해소" 라고 적었다 — 그 항목은
  이미 등재돼 있다.

## TEST 결과

이 라운드의 조치는 **`review/**` 산출물 2줄 정정 + 사실 확인 1건**으로 `codebase/**` 를
건드리지 않는다. 직전 3차 fix 에 대한 전 단계 실행이 유효하다:

- lint : **PASS** (53s)
- unit : **PASS** (73s) — `common/` 345건
- build : **PASS** (144s)
- e2e : **PASS** (305s — backend jest 46 suites/261 + playwright 51)
  > 면제를 주장하는 것이 아니다. 4차 조치 이후 코드 diff 가 **0줄**이므로 위 실행이
  > 그대로 현재 트리에 대한 결과다(`git status` clean, 코드 파일 미변경).

## 보류·후속 항목

3차 RESOLUTION 과 동일 — `plan/in-progress/auth-guard-reflection-hardening.md` §후속:
planner 턴 2건(에러 카탈로그 행 · `code:` 글로브) · developer 3건(README · fixture 공용화 ·
메모이제이션 실측 대기). 신규 추가 없음.
