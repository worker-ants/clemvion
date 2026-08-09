# RESOLUTION — 15_20_33 (fix 후 fresh 라운드)

**Critical 0 · WARNING 1 · INFO 18 · risk LOW.** reviewer 9/9 success, forced 7명 전원 확보.

2차 fix 로 원 리뷰가 stale 해져(push 게이트가 정확히 그것을 지적) 돌린 fresh 라운드다.
**수렴 신호가 뚜렷하다** — 발견의 성격이 1차 동작·구조 → 2차 테스트 공백 → 3차 **테스트
패턴 자기모순 1건**으로 좁혀졌고, INFO 18건 중 다수가 "이미 추적 중" 재확인이다.

## 조치 항목

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| W1 | testing/maintainability | `roles.guard.spec.ts` 의 `expectValidationError` 헬퍼가 **같은 커밋이 다른 두 파일에서 기각한** 이중 호출 assert 를 되살렸다. `canActivate` 를 서로 다른 guard 인스턴스로 두 번 부른다 — 실제 flake 위험은 낮지만, **같은 PR 이 방금 세운 표준을 세 번째 파일에서 근거 없이 어긴다** | **수정.** 캡처-재던지기 1회 호출로 통일. `await expect((async () => { try { … } catch (e) { caught = e; throw e } })()).rejects.toThrow(...)` 형태라 async 경로에서도 단일 호출이 유지된다 |
| INFO 18 | scope | 옮긴 plan 의 frontmatter `status:` 가 `in-progress` 로 남아 있었다 | **수정.** `complete` 로 정정 (1줄, 기록의 정확성 문제라 미루지 않았다) |

### 뮤테이션 — 바꾼 헬퍼가 여전히 code 를 검증하는지

`VALIDATION_ERROR` → `WORKSPACE_ID_REQUIRED` 로 바꾸자 **2건 RED**. 즉 캡처-재던지기 전환
후에도 `getResponse()` 단언이 실제로 돈다(이중 호출을 그냥 지웠다면 vacuous 해졌을 자리다).
원복 후 `common/` 345건 GREEN 재확인.

### 미조치 (INFO 18건)

전부 이미 문서화된 트레이드오프이거나 다른 트랙에 등재돼 있다. 재차 판단이 필요했던 셋:

- **INFO 1** (`void bootstrap()` 이 Node 기본 동작에 의존) — 2차에도 나온 항목이다.
  **가정이지 결함이 아니라** 두되, 캐너리 docstring 이 이 위임 관계를 적고 있어 다음
  사람이 알 수 있다. 지금 `bootstrap().catch(...)` 를 넣으면 이 PR 범위 밖의 부팅
  에러 처리 정책을 혼자 정하게 된다.
- **INFO 9** (헤더 없이 **토큰 클레임**만 malformed 인 경우는 여전히 500) — **의도된
  비대칭**이다. 토큰은 서버가 서명한 값이라 400 은 오귀속이고, 그 상태는 클라이언트가
  만들 수 없다. 운영 로그에서 실제 관측되면 그때 별도 항목으로 다룬다.
- **INFO 17** (`3-error-handling.md §1.3` 미등재) — `--impl-done` 이 이미 WARNING 으로
  잡아 plan §후속 planner 턴에 등재했다. 중복 지적이라 재처리하지 않는다.

## TEST 결과

3차 fix(테스트 헬퍼 1개 + plan frontmatter 1줄) 후 **전 단계 재실행**한 값이다.

- lint : **PASS** (53s)
- unit : **PASS** (73s) — `common/` 345건, guard 스펙 28건 포함
- build : **PASS** (144s)
- e2e : **PASS** (305s — backend jest 46 suites/261 + playwright 51)
  > 코드 변경이므로 면제 대상이 아니다(`PROJECT.md §e2e 면제 화이트리스트`). 헬퍼만
  > 바뀌었어도 "review 반영 직후 fix 가 1~2 줄" 은 그 문서가 명시로 기각한 회피 사유다.

## 보류·후속 항목

`plan/in-progress/auth-guard-reflection-hardening.md` §후속 에 등재 완료:

- planner 턴 2건 — `3-error-handling.md §1.3` 행 추가 · `1-auth.md` `code:` 글로브 확장
- developer 3건 — README 배포 주의 · UUID 픽스처 공용화 · 메모이제이션(실측 트리거 대기)
