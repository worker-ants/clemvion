no-code workflow 빌더 제품을 만드려고 합니다.

# navigation
다음 목록으로 구성됩니다.
```
├── workflow list       # 워크플로우 목록
├── trigger list        # 워크플로우의 트리거 목록 (endpoint 관리)
├── schedule            # 워크플로우를 실행하는 cronjob 규칙
├── integration         # third-party 연동 관리 (slack, google 등)
├── knowledge-base      # Agent가 사용하는 RAG를 위한 지식 저장소 관리
├── config
│   ├── authentication  # trigger 및 워크플로우와 통신하기 위해 third-party에 제공할 인증 방식 설정
│   └── LLM             # AI 에이전트에서 사용할 LLM 설정
├── statistics          # 통계
└── marketplace         # Agent 설정, workflow 구성, integration plug-in 설치 등을 위해 제공되는 마켓플레이스
```

추가 사항으로 로그인된 유저의 이름을 표시하고, 클릭시 사용자 설정 및 로그아웃 버튼이 표시되어야 합니다.

# workflow editor
n8n과 같이 각각의 기능을 가진 node를 canvas에 drag&drop 하고, edge로 node를 연결하여 workflow를 구성하는 노코드 빌더입니다.

## node 목록
### logic
- if/else
- switch
- loop
- Variable declaration
- Variable modification

### flow
- merge
- split
- map
- foreach 

### AI
- AI Agent
- Text Classifier
- Information Extractor