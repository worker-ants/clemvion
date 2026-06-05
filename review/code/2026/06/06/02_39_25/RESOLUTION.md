# RESOLUTION — 02_39_25

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드-테스트 | 92ebe8f2 | lang-detect 엣지 케이스(빈 문자열·일본어·KO_RATIO=0.2 경계) 테스트 추가 |
| #2 | 보류 | — | generate-golden-set.ts binary diff: xxd 확인 결과 UTF-8 텍스트 정상, git이 한글 멀티바이트를 오탐. 코드 내용 Read 성공. 파일 재커밋 불요 |
| #3 | 코드-테스트 | 92ebe8f2 | W1 과 동일 처리(lang-detect describe 블록에 병합) |
| #4 | 코드-테스트 | 92ebe8f2 | positive 0건(전체 shouldRetrieve=false) 케이스 테스트 추가 |
| #5 | 코드-보안 | 92ebe8f2 | --out 경로 CWD 하위 경계 가드 추가 |
| #6 | 코드-보안 | 92ebe8f2 | zod GoldenSetSchema safeParse 런타임 스키마 검증 추가 |
| #7 | 코드-보안 | 92ebe8f2 | kbId UUID 정규식 사전 검증, 비UUID skip |
| #8 | 코드-보안 | 92ebe8f2 | catch 블록 에러 sanitize — ErrorConstructor.name 만 출력 |
| #9 | 코드-요구사항 | 92ebe8f2 | macroAverage NaN guard (Number.isNaN 필터) + 통합 테스트 |
| #10 | 코드-요구사항 | 92ebe8f2 | --fail-metric mrr + --fail-k 동시 지정 시 경고 메시지 출력 |
| #11 | 코드-성능 | 92ebe8f2 | wsCache Promise 캐싱 — 동일 kbId 중복 DB 쿼리 방지 |
| #12 | 보류 | — | evaluateEntry slice 최적화 — 현 규모(수십~수백 entry) 마이크로 최적화, 실운용 확장 시 재검토 |
| #13 | 보류 | — | ndcgAtK log2 정적 테이블 — 동일 사유로 보류 |
| #14 | 코드-성능 | 92ebe8f2 | lang-detect regex 카운팅 루프 — exec() loop로 배열 생성 제거 |
| #15 | 보류 | — | ROOT_ENTITIES 분리 EVAL_CLI_ENTITIES — 중장기 아키텍처 개선, 현재 기능 불영향 |
| #16 | 보류 | — | raw SQL ORDER BY 동적 인터폴레이션 — 현재 2가지 상수('id'/'random()') 중 하나만 사용, 외부 입력 직접 전달 구조 아님. 향후 입력 확장 시 화이트리스트 const 매핑 적용 |
| #17 | 코드-유지보수 | 92ebe8f2 | parseCliFlag cli-utils.ts 추출, 두 스크립트에서 import |
| #18 | 보류 | — | main() 함수 분리 리팩토링 — 기능 불영향 유지보수 작업, 향후 Sprint backlog |
| #19 | 보류 | — | generate-golden-set.ts 람다 중첩 — 동일 사유 보류 |
| #20 | 보류 | — | wsCache Promise 캐싱은 W11(#11)에서 처리됨. 동시성 완전 보장 달성 |
| #21 | 코드-문서 | 92ebe8f2 | eval/README.md .env 전제조건 섹션 추가 |
| #22 | 코드-문서 | 92ebe8f2 | eval/README.md --threshold 플래그 설명 및 예시 추가 |
| #23 | 코드-문서 | 92ebe8f2 | eval/README.md npm scripts 대안 줄 추가(워크플로 1·3단계) |
| #24 | 코드-문서 | 92ebe8f2 | root-entities.ts JSDoc re-export 방향 명확화 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (26 passed — 6 신규 케이스 포함)
- e2e   : 통과 (174/174)

## 보류·후속 항목

- **#2 binary diff**: generate-golden-set.ts 는 UTF-8 텍스트 정상 확인(xxd 검증). git이 한글 멀티바이트 포함 파일을 diff 시 바이너리로 표시한 것으로 추정(`.gitattributes` 미설정). 코드 내용 문제 없음 — 별도 조치 불요.
- **#12/#13 마이크로 최적화**: 수십~수백 entry 현 규모에서 프로파일링 불요. 실운용 수천 entry 규모 도달 시 적용 권장.
- **#15 ROOT_ENTITIES 분리**: EVAL_CLI_ENTITIES 최소 entity 집합 추출은 중장기 아키텍처 개선. 현재 eval 부트스트랩 시간이 문제가 되는 시점에 plan으로 추가 권장.
- **#16 SQL ORDER BY 동적 인터폴레이션**: 현재 `order === 'id' ? 'id' : 'random()'` 상수 2개만 사용. 외부 입력 직접 전달 아님. 향후 orderBy 확장 시 화이트리스트 const 매핑 패턴으로 강제화 권장.
- **#18/#19 리팩토링**: main() 분리 및 람다 중첩 축소 — 기능 불영향, 향후 Sprint에 유지보수 항목으로 추가 권장.
