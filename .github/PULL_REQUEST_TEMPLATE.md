## Summary

<!-- 변경 요약 (1-3 bullet) -->

## Test plan

- [ ] <!-- 테스트 절차 / 검증 결과 -->

## Migration checklist

> `codebase/backend/migrations/**` 를 변경한 PR 만 체크. 그 외 PR 은 본 섹션을 삭제해도 됨.

- [ ] 머지 직전 `git fetch origin main && git merge origin/main` 으로 base 최신화 (코드 리뷰를 내기 전이면 `git rebase origin/main` 도 된다. 리뷰를 낸 뒤 rebase 하면 리뷰를 다시 내야 한다)
- [ ] 최신화 후 push → `migration-check` 가 latest commit 기준 green
- [ ] `migration-recheck-on-main` 알림 코멘트가 게시되어 있으면 위 절차 재수행

상세 규약: [DB 마이그레이션 규약 「충돌 검출과 머지 race 안전망」](../blob/main/spec/CLE-ENG/CLE-ENG-MIGRATION.md#충돌-검출과-머지-race-안전망) (NERV `CLE-ENG-MIGRATION`).

## CLA (기여자 라이선스 동의)

> 프로젝트 저작권자(Sangmin Yeo / worker-ants) 본인은 본 섹션을 삭제해도 됨. 그 외 모든 기여자는 체크 필요.

- [ ] [CLA.md](../blob/main/CLA.md) 전문을 읽었으며 해당 내용에 동의합니다.  
  _I have read the full text of [CLA.md](../blob/main/CLA.md) and I hereby agree to its terms._
