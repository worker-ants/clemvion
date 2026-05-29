## Summary

<!-- 변경 요약 (1-3 bullet) -->

## Test plan

- [ ] <!-- 테스트 절차 / 검증 결과 -->

## Migration checklist

> `codebase/backend/migrations/**` 를 변경한 PR 만 체크. 그 외 PR 은 본 섹션을 삭제해도 됨.

- [ ] 머지 직전 `git fetch origin main && git rebase origin/main` 으로 base 최신화
- [ ] rebase 후 push → `migration-check` 가 latest commit 기준 green
- [ ] `migration-recheck-on-main` 알림 코멘트가 게시되어 있으면 위 절차 재수행

상세 규약: [`spec/conventions/migrations.md`](../blob/main/spec/conventions/migrations.md) §6.2 / §6.3.

## CLA (기여자 라이선스 동의)

> 프로젝트 저작권자(Sangmin Yeo / worker-ants) 본인은 본 섹션을 삭제해도 됨. 그 외 모든 기여자는 체크 필요.

- [ ] [CLA.md](../blob/main/CLA.md) 전문을 읽었으며 해당 내용에 동의합니다.  
  _I have read the full text of [CLA.md](../blob/main/CLA.md) and I hereby agree to its terms._
