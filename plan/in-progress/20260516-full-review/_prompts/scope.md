# 범위(Scope) Full-Project Review Payload

## 미션

main 브랜치(`bbd838ef`) 기준 **최근 ~50 커밋** 을 변경 범위(Scope) 관점에서 검토한다. 전체 코드베이스 audit 보다는, 최근 누적 변경이 "필요 범위" 안에 머물렀는지가 핵심.

## 사용자 강조 관점

병렬 작업이 많을수록 scope creep 위험 증가:

1. **일관성** — 같은 PR 안에 무관 변경이 섞이지 않았는지
2. **스펙 준수** — spec 갱신 없이 코드 동작이 변경되지 않았는지
3. **보안** — scope 밖 코드의 의도치 않은 보안 영향
4. **리팩토링** — 의도된 fix 가 무관한 리팩토링과 섞였는지

## 최근 병렬 작업 컨텍스트

git log 최근 50 커밋을 직접 점검 대상으로 한다. cafe24 followup-backlog 다수 PR 머지가 hot zone.

## 검토 범위

- `git log --oneline -50` 결과의 각 커밋·머지된 PR
- 큰 머지 PR (예: `bb038f90 refactor(integrations): ai-review 후속 — W1·W2·W3·W4 + INFO 5건 처리`) 의 변경 범위 점검
- 각 fix 가 plan/in-progress 의 해당 항목과 1:1 대응되는지

## 작업 지침

1. `git log --oneline -50` 및 큰 머지의 `git show <hash>` 또는 `git diff <hash>^..<hash>` 으로 점검.
2. **의도 이상 변경**: bugfix PR 에 unrelated refactor 포함, fix 가 너무 광범위
3. **불필요 리팩토링**: 의도되지 않은 파일 이동·이름 변경
4. **기능 확장**: bugfix 가 새 기능을 같이 추가 (별도 PR 이 옳음)
5. **무관 수정**: lint·prettier·typo·import 정렬 같은 noise 가 함께 들어옴
6. **포맷팅 노이즈**: 의도된 변경 외 prettier diff 가 PR 을 비대화
7. **plan 미일치**: plan/in-progress 항목과 실제 커밋의 범위 불일치
8. **spec 미반영**: 코드 변경이 spec 갱신 없이 들어옴 (CLAUDE.md MEMORY: "Plan must include spec updates")

## 출력 형식

```
### 발견사항
- **[CRITICAL/WARNING/INFO]** 짧은 제목
  - 위치: <commit-hash> 또는 <path>:<line>
  - 상세
  - 제안

### 요약
1 문단

### 위험도
NONE / LOW / MEDIUM / HIGH / CRITICAL
```

CRITICAL: scope 밖 위험 변경 (보안·DB 마이그). WARNING: noise·과잉 범위. INFO: 권고.
