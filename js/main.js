
        document.addEventListener('DOMContentLoaded', () => {
            
            const likeButtons = document.querySelectorAll('.cardLike');
            likeButtons.forEach(button => {
                button.addEventListener('click', () => {
                    button.classList.toggle('active');
                });
            });
        });